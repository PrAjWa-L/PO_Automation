import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db

app = create_app()
with app.app_context():
    db.create_all()
    print("All tables created successfully.")