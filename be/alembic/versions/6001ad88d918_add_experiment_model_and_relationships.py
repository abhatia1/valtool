"""Add Experiment model and relationships

Revision ID: 6001ad88d918
Revises: b721f96f5ae6
Create Date: 2026-01-28 17:16:53.095853

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6001ad88d918'
down_revision: Union[str, None] = 'b721f96f5ae6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('test_runs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('experiment_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            'fk_test_runs_experiment_id',
            'experiments',
            ['experiment_id'],
            ['experiment_id']
        )


def downgrade() -> None:
    with op.batch_alter_table('test_runs', schema=None) as batch_op:
        batch_op.drop_constraint('fk_test_runs_experiment_id', type_='foreignkey')
        batch_op.drop_column('experiment_id')
