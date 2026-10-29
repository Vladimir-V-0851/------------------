"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-23
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "workouts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("workout_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workouts_category", "workouts", ["category"], unique=False)
    op.create_index("ix_workouts_owner_id", "workouts", ["owner_id"], unique=False)
    op.create_index("ix_workouts_title", "workouts", ["title"], unique=False)
    op.create_index("ix_workouts_workout_date", "workouts", ["workout_date"], unique=False)

    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("sets", sa.Integer(), nullable=False),
        sa.Column("workout_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exercises_name", "exercises", ["name"], unique=False)
    op.create_index("ix_exercises_workout_id", "exercises", ["workout_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_exercises_workout_id", table_name="exercises")
    op.drop_index("ix_exercises_name", table_name="exercises")
    op.drop_table("exercises")
    op.drop_index("ix_workouts_workout_date", table_name="workouts")
    op.drop_index("ix_workouts_title", table_name="workouts")
    op.drop_index("ix_workouts_owner_id", table_name="workouts")
    op.drop_index("ix_workouts_category", table_name="workouts")
    op.drop_table("workouts")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
