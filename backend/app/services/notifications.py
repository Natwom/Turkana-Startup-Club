# services/notifications.py
from sqlalchemy.orm import Session
from app.models import Notification


class EmailSender:
    """Abstraction: swap SMTP/SES/Resend in production. Dev mode logs to console."""
    def send(self, to: str, subject: str, body: str) -> None:
        print(f"[EMAIL] to={to} subject={subject}\n{body}\n")


class SMSSender:
    """SMS-ready architecture: plug Africa's Talking/Twilio later."""
    def send(self, to: str, message: str) -> None:
        print(f"[SMS] to={to}: {message}")


email_sender = EmailSender()
sms_sender = SMSSender()


def notify(db: Session, user_id: str, title: str, body: str = "",
           ntype: str = "general", link: str = "") -> Notification:
    n = Notification(user_id=user_id, title=title, body=body, ntype=ntype, link=link)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n