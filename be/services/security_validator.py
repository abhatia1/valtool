"""
Security Validator Service

Validates Dockerfiles and scans container images for security vulnerabilities.
"""

import re
import subprocess
import json
import logging
from typing import Dict, List, Tuple, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class DockerfileValidator:
    """Validates Dockerfiles for security issues and best practices."""

    # Blocked instructions that pose security risks
    BLOCKED_INSTRUCTIONS = [
        r"EXPOSE\s+22",  # SSH
        r"EXPOSE\s+23",  # Telnet
        r"--privileged",
        r"--cap-add\s+SYS_ADMIN",
        r"--cap-add\s+ALL",
        r"--security-opt\s+seccomp:unconfined",
    ]

    # Blocked base images known to have security issues
    BLOCKED_BASE_IMAGES = [
        r"^scratch$",  # No package manager for updates
    ]

    # Suspicious patterns that may indicate malicious intent
    SUSPICIOUS_PATTERNS = [
        r"curl.*\|.*sh",
        r"wget.*\|.*sh",
        r"curl.*\|.*bash",
        r"wget.*\|.*bash",
        r"chmod\s+777",
        r"chmod\s+\+x\s+/",
        r"/etc/passwd",
        r"/etc/shadow",
        r"nc\s+-l",  # Netcat listener
        r"ncat\s+-l",
        r"rm\s+-rf\s+/[^/]",  # Dangerous rm
    ]

    # Required instructions for ML inference containers
    REQUIRED_INSTRUCTIONS = [
        ("EXPOSE", r"EXPOSE\s+\d+"),
        ("CMD or ENTRYPOINT", r"(CMD|ENTRYPOINT)"),
    ]

    def validate(self, dockerfile_content: str) -> Tuple[bool, List[str]]:
        """
        Validate a Dockerfile for security issues.

        Args:
            dockerfile_content: The content of the Dockerfile

        Returns:
            Tuple of (is_valid, list of issues/warnings)
        """
        issues = []
        warnings = []

        # Check for blocked instructions
        for pattern in self.BLOCKED_INSTRUCTIONS:
            if re.search(pattern, dockerfile_content, re.IGNORECASE):
                issues.append(f"Blocked instruction detected: {pattern}")

        # Check base image
        from_match = re.search(r"FROM\s+(\S+)", dockerfile_content, re.IGNORECASE)
        if from_match:
            base_image = from_match.group(1)
            for blocked in self.BLOCKED_BASE_IMAGES:
                if re.match(blocked, base_image, re.IGNORECASE):
                    issues.append(f"Blocked base image: {base_image}")
        else:
            issues.append("No FROM instruction found")

        # Check for suspicious patterns
        for pattern in self.SUSPICIOUS_PATTERNS:
            if re.search(pattern, dockerfile_content, re.IGNORECASE):
                warnings.append(f"Suspicious pattern detected: {pattern}")

        # Check required instructions
        for name, pattern in self.REQUIRED_INSTRUCTIONS:
            if not re.search(pattern, dockerfile_content, re.IGNORECASE):
                issues.append(f"Missing required instruction: {name}")

        # Check for USER instruction (running as non-root)
        if not re.search(r"USER\s+\S+", dockerfile_content, re.IGNORECASE):
            warnings.append("No USER instruction found - container will run as root")

        # Combine issues and warnings
        all_messages = issues + [f"[Warning] {w}" for w in warnings]

        # Return validation result
        is_valid = len(issues) == 0
        return is_valid, all_messages

    def validate_file(self, dockerfile_path: str) -> Tuple[bool, List[str]]:
        """
        Validate a Dockerfile from a file path.

        Args:
            dockerfile_path: Path to the Dockerfile

        Returns:
            Tuple of (is_valid, list of issues/warnings)
        """
        try:
            with open(dockerfile_path, "r") as f:
                content = f.read()
            return self.validate(content)
        except FileNotFoundError:
            return False, [f"Dockerfile not found: {dockerfile_path}"]
        except Exception as e:
            return False, [f"Error reading Dockerfile: {str(e)}"]


class ImageScanner:
    """Scans Docker images for vulnerabilities using trivy."""

    def __init__(
        self,
        max_critical: int = 0,
        max_high: int = 5,
        max_medium: int = 20,
        max_low: int = 50,
    ):
        """
        Initialize the image scanner.

        Args:
            max_critical: Maximum allowed critical vulnerabilities
            max_high: Maximum allowed high vulnerabilities
            max_medium: Maximum allowed medium vulnerabilities
            max_low: Maximum allowed low vulnerabilities
        """
        self.max_critical = max_critical
        self.max_high = max_high
        self.max_medium = max_medium
        self.max_low = max_low

    async def scan(self, image_name: str) -> Dict[str, Any]:
        """
        Scan a Docker image for vulnerabilities.

        Args:
            image_name: Name of the Docker image to scan

        Returns:
            Dictionary containing scan results
        """
        try:
            # Check if trivy is available
            trivy_check = subprocess.run(
                ["which", "trivy"],
                capture_output=True,
                text=True,
            )

            if trivy_check.returncode != 0:
                logger.warning("Trivy not installed, skipping security scan")
                return {
                    "status": "skipped",
                    "reason": "trivy not installed",
                    "vulnerabilities": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                    "passed": True,
                    "details": [],
                }

            # Run trivy scan
            result = subprocess.run(
                [
                    "trivy",
                    "image",
                    "--format", "json",
                    "--severity", "CRITICAL,HIGH,MEDIUM,LOW",
                    "--quiet",
                    image_name,
                ],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode != 0 and "No such image" in result.stderr:
                return {
                    "status": "error",
                    "reason": f"Image not found: {image_name}",
                    "vulnerabilities": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                    "passed": False,
                    "details": [],
                }

            # Parse results
            try:
                scan_results = json.loads(result.stdout) if result.stdout else {}
            except json.JSONDecodeError:
                scan_results = {}

            # Count vulnerabilities by severity
            vuln_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            details = []

            results_list = scan_results.get("Results", [])
            for target in results_list:
                vulnerabilities = target.get("Vulnerabilities", [])
                for vuln in vulnerabilities:
                    severity = vuln.get("Severity", "UNKNOWN").lower()
                    if severity in vuln_counts:
                        vuln_counts[severity] += 1
                        if len(details) < 50:  # Limit details
                            details.append({
                                "id": vuln.get("VulnerabilityID"),
                                "package": vuln.get("PkgName"),
                                "severity": severity,
                                "title": vuln.get("Title", ""),
                            })

            return {
                "status": "completed",
                "vulnerabilities": vuln_counts,
                "passed": self.is_acceptable(vuln_counts),
                "details": details,
            }

        except subprocess.TimeoutExpired:
            logger.error(f"Scan timed out for image: {image_name}")
            return {
                "status": "error",
                "reason": "Scan timed out",
                "vulnerabilities": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                "passed": False,
                "details": [],
            }
        except Exception as e:
            logger.error(f"Error scanning image {image_name}: {str(e)}")
            return {
                "status": "error",
                "reason": str(e),
                "vulnerabilities": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                "passed": False,
                "details": [],
            }

    def is_acceptable(self, vuln_counts: Dict[str, int]) -> bool:
        """
        Check if vulnerability counts are within acceptable limits.

        Args:
            vuln_counts: Dictionary of vulnerability counts by severity

        Returns:
            True if acceptable, False otherwise
        """
        return (
            vuln_counts.get("critical", 0) <= self.max_critical
            and vuln_counts.get("high", 0) <= self.max_high
            and vuln_counts.get("medium", 0) <= self.max_medium
            and vuln_counts.get("low", 0) <= self.max_low
        )


class SecurityValidator:
    """Combined security validator for Dockerfiles and images."""

    def __init__(
        self,
        max_critical: int = 0,
        max_high: int = 5,
        max_medium: int = 20,
        max_low: int = 50,
    ):
        """Initialize the security validator."""
        self.dockerfile_validator = DockerfileValidator()
        self.image_scanner = ImageScanner(
            max_critical=max_critical,
            max_high=max_high,
            max_medium=max_medium,
            max_low=max_low,
        )

    def validate_dockerfile(self, dockerfile_path: str) -> Tuple[bool, List[str]]:
        """
        Validate a Dockerfile.

        Args:
            dockerfile_path: Path to the Dockerfile

        Returns:
            Tuple of (is_valid, list of issues)
        """
        return self.dockerfile_validator.validate_file(dockerfile_path)

    async def scan_image(self, image_name: str) -> Dict[str, Any]:
        """
        Scan a Docker image for vulnerabilities.

        Args:
            image_name: Name of the Docker image

        Returns:
            Scan results dictionary
        """
        return await self.image_scanner.scan(image_name)

    async def full_validation(
        self,
        dockerfile_path: str,
        image_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Perform full validation including Dockerfile check and optional image scan.

        Args:
            dockerfile_path: Path to the Dockerfile
            image_name: Optional image name to scan after build

        Returns:
            Combined validation results
        """
        # Validate Dockerfile
        dockerfile_valid, dockerfile_issues = self.validate_dockerfile(dockerfile_path)

        result = {
            "dockerfile_valid": dockerfile_valid,
            "dockerfile_issues": dockerfile_issues,
            "image_scan": None,
            "overall_passed": dockerfile_valid,
        }

        # Scan image if provided and Dockerfile is valid
        if image_name and dockerfile_valid:
            scan_result = await self.scan_image(image_name)
            result["image_scan"] = scan_result
            result["overall_passed"] = dockerfile_valid and scan_result.get("passed", False)

        return result
