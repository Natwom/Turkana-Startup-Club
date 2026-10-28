"""
One-time backfill: award the verified badge to every existing member who already
has enough accepted connections.

Run from the backend/ folder, AFTER the migration:
    python backfill_verification.py

For the hosted database, make sure DATABASE_URL (backend/.env or your shell)
points at production first.
"""
from app.db.session import get_db
from app.models import User
from app.services.verification import auto_verify_if_eligible


def main() -> None:
    db = next(get_db())
    try:
        candidates = db.query(User).filter(
            User.is_badge_verified == False,  # noqa: E712
            User.is_suspended == False,  # noqa: E712
        ).all()
        awarded = 0
        for u in candidates:
            try:
                if auto_verify_if_eligible(db, u.id):
                    awarded += 1
                    print(f"badge awarded: {u.full_name} <{u.email}>")
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                print(f"failed for {u.email}: {exc}")
        print(f"Done. Checked {len(candidates)} members, awarded {awarded} badges.")
    finally:
        db.close()


if __name__ == "__main__":
    main()