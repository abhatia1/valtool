"""
Container Runner Service

Handles Docker container lifecycle management for external models.
"""

import os
import time
import socket
import asyncio
import logging
import httpx
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from models.database import ExternalModel, ContainerInstance, BenchmarkRequestLog
from services.security_validator import ImageScanner
from services.external_model_manager import ExternalModelManager

logger = logging.getLogger(__name__)

# Configuration defaults
DEFAULT_CPU_LIMIT = "1.0"
DEFAULT_MEMORY_LIMIT = "512m"
DEFAULT_TIMEOUT = 30
DEFAULT_IDLE_TIMEOUT = 300
PORT_RANGE_START = 9000
PORT_RANGE_END = 9999

# Try to import docker, but handle gracefully if not available
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    logger.warning("Docker SDK not installed. Container functionality will be limited.")


class ContainerRunner:
    """Manages Docker container lifecycle for external models."""

    def __init__(self, db: Session):
        """
        Initialize the container runner.

        Args:
            db: Database session
        """
        self.db = db
        self.image_scanner = ImageScanner()
        self._docker_client = None
        self._used_ports: set = set()

    @property
    def docker_client(self):
        """Lazy initialization of Docker client."""
        if not DOCKER_AVAILABLE:
            raise RuntimeError("Docker SDK not installed. Run: pip install docker")

        if self._docker_client is None:
            try:
                self._docker_client = docker.from_env()
                self._docker_client.ping()
            except Exception as e:
                logger.error(f"Failed to connect to Docker: {e}")
                raise RuntimeError(f"Docker not available: {e}")

        return self._docker_client

    def _find_available_port(self) -> int:
        """Find an available port in the configured range."""
        for port in range(PORT_RANGE_START, PORT_RANGE_END):
            if port in self._used_ports:
                continue

            # Check if port is actually available
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("localhost", port))
                    self._used_ports.add(port)
                    return port
                except OSError:
                    continue

        raise RuntimeError("No available ports in configured range")

    def _release_port(self, port: int):
        """Release a port back to the pool."""
        self._used_ports.discard(port)

    async def build_image(
        self,
        model_id: str,
        progress_callback: Optional[callable] = None,
    ) -> Tuple[bool, str]:
        """
        Build a Docker image for an external model.

        Args:
            model_id: External model ID
            progress_callback: Optional callback for progress updates

        Returns:
            Tuple of (success, message or image_name)
        """
        # Get model from database
        model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

        if not model:
            return False, "Model not found"

        if not model.dockerfile_path or not os.path.exists(model.dockerfile_path):
            return False, "Dockerfile not found"

        # Update status to building
        model.build_status = "building"
        model.build_progress = 0
        model.current_build_step = "Initializing build"
        model.build_logs = ""
        self.db.commit()

        try:
            # Get build context directory
            context_path = os.path.dirname(model.dockerfile_path)
            image_name = f"valtool-external-{model_id[:8]}:latest"

            # Update progress
            self._update_build_progress(model, 10, "Starting Docker build")

            # Build the image
            build_logs = []
            image, build_generator = self.docker_client.images.build(
                path=context_path,
                dockerfile="Dockerfile",
                tag=image_name,
                rm=True,
                forcerm=True,
                decode=True,
            )

            # Process build logs
            for chunk in build_generator:
                if "stream" in chunk:
                    log_line = chunk["stream"].strip()
                    if log_line:
                        build_logs.append(log_line)
                        # Update progress based on build steps
                        if "Step" in log_line:
                            self._update_build_progress(
                                model,
                                min(80, model.build_progress + 10),
                                log_line[:100],
                            )

                if "error" in chunk:
                    error_msg = chunk["error"]
                    self._update_build_progress(model, 0, "Build failed", "\n".join(build_logs))
                    model.build_status = "failed"
                    self.db.commit()
                    return False, error_msg

            # Update model with image info
            model.image_name = image_name
            model.image_id = image.id
            model.build_logs = "\n".join(build_logs)
            self._update_build_progress(model, 90, "Build complete, scanning image")

            # Run security scan
            scan_result = await self.scan_image(model_id, image_name)

            if not scan_result.get("passed", False):
                model.build_status = "failed"
                model.security_scan_status = "failed"
                model.build_logs += f"\nSecurity scan failed: {scan_result}"
                self.db.commit()
                return False, "Security scan failed"

            # Update final status
            model.build_status = "ready"
            model.build_progress = 100
            model.current_build_step = "Ready"
            model.security_scan_status = "passed"
            model.vulnerability_count = scan_result.get("vulnerabilities")
            model.validated_at = datetime.utcnow()
            self.db.commit()

            logger.info(f"Successfully built image for model {model_id}: {image_name}")
            return True, image_name

        except Exception as e:
            logger.error(f"Error building image for model {model_id}: {e}")
            model.build_status = "failed"
            model.build_logs = (model.build_logs or "") + f"\nBuild error: {str(e)}"
            self.db.commit()
            return False, str(e)

    def _update_build_progress(
        self,
        model: ExternalModel,
        progress: int,
        step: str,
        logs: Optional[str] = None,
    ):
        """Update build progress in database."""
        model.build_progress = progress
        model.current_build_step = step
        if logs:
            model.build_logs = logs
        self.db.commit()

    async def scan_image(self, model_id: str, image_name: str) -> Dict[str, Any]:
        """
        Scan a Docker image for vulnerabilities.

        Args:
            model_id: External model ID
            image_name: Docker image name

        Returns:
            Scan results dictionary
        """
        model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

        if model:
            model.security_scan_status = "scanning"
            self.db.commit()

        result = await self.image_scanner.scan(image_name)

        if model:
            model.security_scan_status = "passed" if result.get("passed") else "failed"
            model.vulnerability_count = result.get("vulnerabilities")
            self.db.commit()

        return result

    async def validate_endpoint(
        self,
        model_id: str,
        sample_input: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Validate that the model's /predict endpoint works.

        Args:
            model_id: External model ID
            sample_input: Optional sample input for testing

        Returns:
            Validation result dictionary
        """
        model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

        if not model:
            return {"valid": False, "error": "Model not found"}

        if model.build_status != "ready":
            return {"valid": False, "error": "Model not ready"}

        # Start container temporarily for validation
        try:
            instance = await self.start_container(model_id)
            if not instance:
                return {"valid": False, "error": "Failed to start container"}

            # Wait for container to be ready
            await asyncio.sleep(3)

            # Test endpoint
            endpoint_url = f"http://localhost:{instance.host_port}{model.predict_endpoint}"

            # Use sample input or generate minimal test data
            test_data = sample_input or {"data": [[1.0, 2.0, 3.0]]}

            async with httpx.AsyncClient(timeout=30) as client:
                start_time = time.time()
                response = await client.post(endpoint_url, json=test_data)
                response_time = (time.time() - start_time) * 1000

                result = {
                    "valid": response.status_code == 200,
                    "endpoint": endpoint_url,
                    "response_time_ms": response_time,
                    "status_code": response.status_code,
                    "sample_input": test_data,
                }

                if response.status_code == 200:
                    result["sample_output"] = response.json()
                else:
                    result["error"] = response.text

            # Stop container after validation
            await self.stop_container(model_id)

            # Update model validation timestamp
            if result["valid"]:
                model.validated_at = datetime.utcnow()
                self.db.commit()

            return result

        except Exception as e:
            logger.error(f"Error validating endpoint for model {model_id}: {e}")
            await self.stop_container(model_id)
            return {"valid": False, "error": str(e)}

    async def start_container(self, model_id: str) -> Optional[ContainerInstance]:
        """
        Start a Docker container for an external model.

        Args:
            model_id: External model ID

        Returns:
            ContainerInstance or None if failed
        """
        model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

        if not model or not model.image_name:
            logger.error(f"Cannot start container: model {model_id} not found or not built")
            return None

        # Check for existing running instance
        existing = self.db.query(ContainerInstance).filter(
            ContainerInstance.external_model_id == model_id,
            ContainerInstance.status == "running",
        ).first()

        if existing:
            return existing

        try:
            # Find available port
            host_port = self._find_available_port()

            # Create container with security constraints
            container = self.docker_client.containers.run(
                model.image_name,
                detach=True,
                name=f"valtool-benchmark-{model_id[:8]}-{host_port}",
                ports={"8080/tcp": host_port},
                cpu_quota=int(float(model.cpu_limit or DEFAULT_CPU_LIMIT) * 100000),
                mem_limit=model.memory_limit or DEFAULT_MEMORY_LIMIT,
                memswap_limit=model.memory_limit or DEFAULT_MEMORY_LIMIT,  # No swap
                read_only=False,  # Some ML models need to write temp files
                cap_drop=["ALL"],  # Drop all Linux capabilities
                security_opt=["no-new-privileges"],
                network_mode="bridge",
            )

            # Create database record
            instance = ContainerInstance(
                external_model_id=model_id,
                container_id=container.id,
                container_name=container.name,
                status="running",
                host_port=host_port,
                internal_port=8080,
                started_at=datetime.utcnow(),
            )

            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)

            logger.info(f"Started container for model {model_id} on port {host_port}")
            return instance

        except Exception as e:
            logger.error(f"Error starting container for model {model_id}: {e}")
            self._release_port(host_port)
            return None

    async def stop_container(self, model_id: str) -> bool:
        """
        Stop a running container for an external model.

        Args:
            model_id: External model ID

        Returns:
            True if stopped successfully
        """
        instance = self.db.query(ContainerInstance).filter(
            ContainerInstance.external_model_id == model_id,
            ContainerInstance.status == "running",
        ).first()

        if not instance:
            return True  # Already stopped

        try:
            # Get container and stop it
            container = self.docker_client.containers.get(instance.container_id)
            container.stop(timeout=10)
            container.remove()

            # Release port
            if instance.host_port:
                self._release_port(instance.host_port)

            # Update database
            instance.status = "stopped"
            instance.stopped_at = datetime.utcnow()
            self.db.commit()

            logger.info(f"Stopped container for model {model_id}")
            return True

        except Exception as e:
            logger.error(f"Error stopping container for model {model_id}: {e}")
            # Mark as stopped anyway
            instance.status = "stopped"
            instance.stopped_at = datetime.utcnow()
            self.db.commit()
            return False

    def get_container_status(self, model_id: str) -> Dict[str, Any]:
        """
        Get the status of a container for an external model.

        Args:
            model_id: External model ID

        Returns:
            Container status dictionary
        """
        instance = self.db.query(ContainerInstance).filter(
            ContainerInstance.external_model_id == model_id,
        ).order_by(ContainerInstance.created_at.desc()).first()

        if not instance:
            return {"status": "not_created", "model_id": model_id}

        result = {
            "instance_id": instance.instance_id,
            "model_id": model_id,
            "status": instance.status,
            "container_id": instance.container_id,
            "host_port": instance.host_port,
            "request_count": instance.request_count,
            "last_request_at": instance.last_request_at,
        }

        if instance.started_at and instance.status == "running":
            result["uptime_seconds"] = (datetime.utcnow() - instance.started_at).total_seconds()

        return result

    async def predict(
        self,
        model_id: str,
        data: List[Dict[str, Any]],
        timeout: Optional[int] = None,
    ) -> Tuple[Optional[List[Any]], float]:
        """
        Run prediction on an external model container.

        Args:
            model_id: External model ID
            data: Input data for prediction
            timeout: Optional timeout in seconds

        Returns:
            Tuple of (predictions, inference_time_ms)
        """
        model = self.db.query(ExternalModel).filter(
            ExternalModel.model_id == model_id
        ).first()

        if not model:
            raise ValueError(f"Model not found: {model_id}")

        # Ensure container is running
        instance = await self.start_container(model_id)
        if not instance:
            raise RuntimeError(f"Failed to start container for model {model_id}")

        # Wait for container to be ready
        await self._wait_for_container_ready(instance.host_port)

        # Make prediction request
        endpoint_url = f"http://localhost:{instance.host_port}{model.predict_endpoint}"
        request_timeout = timeout or model.timeout_seconds or DEFAULT_TIMEOUT

        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                start_time = time.time()
                response = await client.post(endpoint_url, json={"data": data})
                inference_time_ms = (time.time() - start_time) * 1000

                # Log request
                self._log_request(
                    model_id=model_id,
                    instance_id=instance.instance_id,
                    request_type="predict",
                    input_size=len(data),
                    status_code=response.status_code,
                    response_time_ms=inference_time_ms,
                )

                # Update instance stats
                instance.request_count += 1
                instance.total_inference_time_ms += inference_time_ms
                instance.last_request_at = datetime.utcnow()
                self.db.commit()

                if response.status_code != 200:
                    raise RuntimeError(f"Prediction failed: {response.text}")

                result = response.json()
                predictions = result.get("predictions", result)

                return predictions, inference_time_ms

        except httpx.TimeoutException:
            self._log_request(
                model_id=model_id,
                instance_id=instance.instance_id,
                request_type="predict",
                input_size=len(data),
                status_code=408,
                response_time_ms=request_timeout * 1000,
                error_message="Request timed out",
            )
            raise RuntimeError(f"Prediction timed out after {request_timeout}s")

    async def _wait_for_container_ready(self, port: int, max_wait: int = 30):
        """Wait for container to be ready to accept connections."""
        endpoint = f"http://localhost:{port}/health"

        for _ in range(max_wait):
            try:
                async with httpx.AsyncClient(timeout=2) as client:
                    response = await client.get(endpoint)
                    if response.status_code in [200, 404]:  # 404 is ok, means server is up
                        return
            except Exception:
                pass
            await asyncio.sleep(1)

        logger.warning(f"Container on port {port} may not be fully ready after {max_wait}s")

    def _log_request(
        self,
        model_id: str,
        instance_id: str,
        request_type: str,
        input_size: int,
        status_code: int,
        response_time_ms: float,
        benchmark_id: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Log a request to the database."""
        log = BenchmarkRequestLog(
            benchmark_id=benchmark_id,
            external_model_id=model_id,
            instance_id=instance_id,
            request_type=request_type,
            input_size=input_size,
            status_code=status_code,
            response_time_ms=response_time_ms,
            error_message=error_message,
        )
        self.db.add(log)
        self.db.commit()

    async def cleanup_idle_containers(self, idle_timeout: int = DEFAULT_IDLE_TIMEOUT):
        """
        Clean up containers that have been idle too long.

        Args:
            idle_timeout: Idle timeout in seconds
        """
        cutoff_time = datetime.utcnow()

        # Find idle instances
        instances = self.db.query(ContainerInstance).filter(
            ContainerInstance.status == "running",
        ).all()

        for instance in instances:
            if instance.last_request_at:
                idle_seconds = (cutoff_time - instance.last_request_at).total_seconds()
            elif instance.started_at:
                idle_seconds = (cutoff_time - instance.started_at).total_seconds()
            else:
                idle_seconds = float("inf")

            if idle_seconds > idle_timeout:
                logger.info(f"Cleaning up idle container for model {instance.external_model_id}")
                await self.stop_container(instance.external_model_id)
