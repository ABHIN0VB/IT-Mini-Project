import os
import csv
import io
from flask import Flask, request, jsonify, session, send_file, send_from_directory, g
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from datetime import datetime, timezone

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'your_super_secret_key_change_this'

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'quizverse.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(50), nullable=False)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

class Quiz(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    duration_minutes = db.Column(db.Integer, nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    questions = db.relationship('Question', backref='quiz', lazy=True, cascade="all, delete-orphan")
    attempts = db.relationship('Attempt', backref='quiz', lazy=True, cascade="all, delete-orphan")
    proctor_logs = db.relationship('ProctorLog', backref='quiz', lazy=True, cascade="all, delete-orphan")

    @property
    def question_count(self):
        return len(self.questions)

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    option_a = db.Column(db.String(200), nullable=False)
    option_b = db.Column(db.String(200), nullable=False)
    option_c = db.Column(db.String(200), nullable=False)
    option_d = db.Column(db.String(200), nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False) 

class Attempt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    score = db.Column(db.Integer)
    total_questions = db.Column(db.Integer)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = db.Column(db.DateTime)
    finished = db.Column(db.Boolean, default=False)
    
    student = db.relationship('User', backref='attempts')

class ProctorLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    student = db.relationship('User', backref='proctor_logs')

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# --- API Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('role'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    new_user = User(email=data['email'], role=data['role'])
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    return jsonify({'uid': new_user.id, 'email': new_user.email, 'role': new_user.role}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
        
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        login_user(user)
        return jsonify({'uid': user.id, 'email': user.email, 'role': user.role}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/session', methods=['GET'])
def check_session():
    if current_user.is_authenticated:
        return jsonify({'uid': current_user.id, 'email': current_user.email, 'role': current_user.role}), 200
    return jsonify({'error': 'Not authenticated'}), 401
@app.route('/api/quizzes', methods=['GET', 'POST'])
@login_required
def manage_quizzes():
    if current_user.role != 'teacher':
        return jsonify({'error': 'Not authorized'}), 403

    if request.method == 'POST':
       
        data = request.get_json()
        try:
            start_time = datetime.fromisoformat(data['startTime'].replace('Z', '+00:00'))
            
            new_quiz = Quiz(
                title=data['title'],
                start_time=start_time,
                duration_minutes=int(data['durationMinutes']),
                teacher_id=current_user.id
            )
            db.session.add(new_quiz)
            db.session.commit()
            return jsonify({'id': new_quiz.id, 'title': new_quiz.title}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error creating quiz: {str(e)}'}), 400

    if request.method == 'GET':
        
        quizzes = Quiz.query.filter_by(teacher_id=current_user.id).all()
        quiz_list = [{
            'id': q.id,
            'title': q.title,
            'startTime': q.start_time.isoformat(),
            'durationMinutes': q.duration_minutes,
            'questionCount': q.question_count
        } for q in quizzes]
        return jsonify(quiz_list), 200

@app.route('/api/quizzes/<int:quiz_id>', methods=['GET', 'DELETE'])
@login_required
def manage_quiz_details(quiz_id):
    quiz = db.session.get(Quiz, quiz_id)

    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404

    if request.method == 'DELETE':
        if current_user.role != 'teacher':
            return jsonify({'error': 'Not authorized'}), 403
        
        if quiz.teacher_id != current_user.id:
            return jsonify({'error': 'Not authorized to delete this quiz'}), 403
            
        try:
            db.session.delete(quiz)
            db.session.commit()
            return jsonify({'message': 'Quiz deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error deleting quiz: {str(e)}'}), 500

    if request.method == 'GET':
        if current_user.role == 'teacher' and quiz.teacher_id != current_user.id:
            return jsonify({'error': 'Not authorized to view this quiz'}), 403
            
        questions = Question.query.filter_by(quiz_id=quiz.id).all()
        question_list = [{
            'id': q.id,
            'text': q.text,
            'options': {'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d},
            'correctAnswer': q.correct_answer
        } for q in questions]
        
        attempts = Attempt.query.filter_by(quiz_id=quiz.id).all()
        results_list = [{
            'studentEmail': a.student.email,
            'score': a.score,
            'totalQuestions': a.total_questions,
            'finishedAt': a.finished_at.isoformat() if a.finished_at else None
        } for a in attempts]
        
        logs = ProctorLog.query.filter_by(quiz_id=quiz.id).all()
        logs_list = [{
            'studentEmail': log.student.email,
            'eventType': log.event_type,
            'questionNumber': log.question_number,
            'timestamp': log.timestamp.isoformat()
        } for log in logs]
        
        return jsonify({
            'id': quiz.id,
            'title': quiz.title,
            'questions': question_list,
            'results': results_list,
            'proctorLogs': logs_list
        }), 200

@app.route('/api/quizzes/<int:quiz_id>/questions/manual', methods=['POST'])
@login_required
def add_question_manual(quiz_id):
    if current_user.role != 'teacher':
        return jsonify({'error': 'Not authorized'}), 403
        
    quiz = db.session.get(Quiz, quiz_id)
    if not quiz or quiz.teacher_id != current_user.id:
        return jsonify({'error': 'Quiz not found or not authorized'}), 404
    
    data = request.get_json()
    
    try:
        if not all(key in data for key in ['text', 'options', 'correctAnswer']):
            raise ValueError("Missing required fields (text, options, correctAnswer)")
        if not all(key in data['options'] for key in ['A', 'B', 'C', 'D']):
             raise ValueError("Missing option fields (A, B, C, D)")
             
        new_question = Question(
            quiz_id=quiz.id,
            text=data['text'],
            option_a=data['options']['A'],
            option_b=data['options']['B'],
            option_c=data['options']['C'],
            option_d=data['options']['D'],
            correct_answer=data['correctAnswer']
        )
        db.session.add(new_question)
        db.session.commit()
        return jsonify({'id': new_question.id, 'text': new_question.text}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error adding question: {str(e)}'}), 400


@app.route('/api/quizzes/<int:quiz_id>/questions/csv', methods=['POST'])
@login_required
def add_questions_csv(quiz_id):
    if current_user.role != 'teacher':
        return jsonify({'error': 'Not authorized'}), 403
        
    quiz = db.session.get(Quiz, quiz_id)
    if not quiz or quiz.teacher_id != current_user.id:
        return jsonify({'error': 'Quiz not found or not authorized'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.csv'):
        added_count = 0
        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)
            
            for row in csv_reader:
                if not all(key in row for key in ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']):
                    raise ValueError("Missing columns in CSV")
                
                correct_ans = row['correct_answer'].upper()
                if correct_ans not in ['A', 'B', 'C', 'D']:
                    raise ValueError(f"Invalid correct_answer value: {row['correct_answer']}")

                new_question = Question(
                    quiz_id=quiz.id,
                    text=row['question_text'],
                    option_a=row['option_a'],
                    option_b=row['option_b'],
                    option_c=row['option_c'],
                    option_d=row['option_d'],
                    correct_answer=correct_ans
                )
                db.session.add(new_question)
                added_count += 1
            db.session.commit()
            return jsonify({'message': f'Successfully added {added_count} questions.'}), 201
        
        except UnicodeDecodeError:
            db.session.rollback()
            return jsonify({'error': 'Error processing CSV: The file is not UTF-8 encoded. Please re-save your CSV as "UTF-8".'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error processing CSV: {str(e)}'}), 400
    
    return jsonify({'error': 'Invalid file type. Must be .csv'}), 400

@app.route('/api/student/quizzes', methods=['GET'])
@login_required
def get_student_quizzes():
    if current_user.role != 'student':
        return jsonify({'error': 'Not authorized'}), 403
        
    all_quizzes = Quiz.query.all()
    quiz_list = []
    
    for q in all_quizzes:
        attempt = Attempt.query.filter_by(quiz_id=q.id, student_id=current_user.id).first()
        quiz_data = {
            'id': q.id,
            'title': q.title,
            'startTime': q.start_time.isoformat(),
            'durationMinutes': q.duration_minutes,
            'questionCount': q.question_count,
            'attempt': None
        }
        if attempt:
            quiz_data['attempt'] = {
                'score': attempt.score,
                'totalQuestions': attempt.total_questions,
                'finished': attempt.finished
            }
        quiz_list.append(quiz_data)
        
    return jsonify(quiz_list), 200

@app.route('/api/student/quiz/<int:quiz_id>/start', methods=['POST'])
@login_required
def start_quiz_attempt(quiz_id):
    if current_user.role != 'student':
        return jsonify({'error': 'Not authorized'}), 403
    
    quiz = db.session.get(Quiz, quiz_id)
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404
        
    attempt = Attempt.query.filter_by(quiz_id=quiz.id, student_id=current_user.id).first()
    if attempt:
        return jsonify({'error': 'Quiz already attempted'}), 400
        
    if datetime.utcnow() < quiz.start_time:
        return jsonify({'error': 'Quiz has not started yet'}), 403
        
    try:
        new_attempt = Attempt(
            quiz_id=quiz.id,
            student_id=current_user.id
        )
        db.session.add(new_attempt)
        db.session.commit()
        
        questions = Question.query.filter_by(quiz_id=quiz.id).all()
        question_list = [{
            'id': q.id,
            'text': q.text,
            'options': {'A': q.option_a, 'B': q.option_b, 'C': q.option_c, 'D': q.option_d}
        } for q in questions]
        
        return jsonify({
            'attemptId': new_attempt.id,
            'quizTitle': quiz.title,
            'duration': quiz.duration_minutes,
            'questions': question_list
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error starting quiz: {str(e)}'}), 400


@app.route('/api/student/quiz/<int:quiz_id>/submit', methods=['POST'])
@login_required
def submit_quiz_attempt(quiz_id):
    if current_user.role != 'student':
        return jsonify({'error': 'Not authorized'}), 403
        
    attempt = Attempt.query.filter_by(quiz_id=quiz_id, student_id=current_user.id, finished=False).first()
    if not attempt:
        return jsonify({'error': 'No active attempt found'}), 404
        
    data = request.get_json()
    student_answers = data.get('answers', {}) 
    
    try:
        questions = Question.query.filter_by(quiz_id=quiz_id).all()
        score = 0
        total = len(questions)
        
        for q in questions:
            student_ans = student_answers.get(str(q.id))
            if student_ans and student_ans == q.correct_answer:
                score += 1
                
        attempt.score = score
        attempt.total_questions = total
        attempt.finished = True
        attempt.finished_at = datetime.now(timezone.utc)
        db.session.commit()
        
        return jsonify({
            'score': score,
            'totalQuestions': total
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error submitting quiz: {str(e)}'}), 400

@app.route('/api/student/quiz/<int:quiz_id>/log', methods=['POST'])
@login_required
def log_proctor_event(quiz_id):
    if current_user.role != 'student':
        return jsonify({'error': 'Not authorized'}), 403

    data = request.get_json()
    try:
        new_log = ProctorLog(
            quiz_id=quiz_id,
            student_id=current_user.id,
            event_type=data['eventType'],
            question_number=data['questionNumber']
        )
        db.session.add(new_log)
        db.session.commit()
        return jsonify({'status': 'logged'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error logging event: {str(e)}'}), 400

@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    app.run(debug=True, port=5000)
