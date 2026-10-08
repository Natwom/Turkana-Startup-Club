import getpass
from app.db.session import SessionLocal
import app.models  # loads all models so relationships resolve
from app.models.user import User, MemberProfile
from app.models.admin import Role
from app.core.security import hash_password

ROLE_NAME = "SUPER_ADMIN"

db = SessionLocal()
try:
    roles = {r.name: r for r in db.query(Role).all()}
    print("Roles in database:", sorted(roles) or "none yet")
    role = roles.get(ROLE_NAME)
    if not role:
        raise SystemExit(
            f"Role {ROLE_NAME} not found. Start the backend once so main.py seeds the roles, "
            "or change ROLE_NAME above to one of the roles listed."
        )

    email = input("Admin email: ").strip().lower()
    full_name = input("Full name: ").strip()
    password = getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        raise SystemExit("Password too short.")
    if getpass.getpass("Confirm password: ") != password:
        raise SystemExit("Passwords do not match.")

    user = db.query(User).filter(User.email == email).first()
    if user:
        print("User exists, upgrading it to admin and resetting the password.")
        user.hashed_password = hash_password(password)
    else:
        user = User(email=email, full_name=full_name, hashed_password=hash_password(password))
        db.add(user)
    user.is_verified = True
    user.is_suspended = False
    if role not in user.roles:
        user.roles.append(role)
    db.commit()

    # profile row, in case /auth/me expects one
    try:
        if not db.query(MemberProfile).filter(MemberProfile.user_id == user.id).first():
            db.add(MemberProfile(user_id=user.id))
            db.commit()
    except Exception as e:
        db.rollback()
        print("Skipped profile creation:", e)

    print(f"Done. {email} is now {ROLE_NAME} and verified.")
finally:
    db.close()
