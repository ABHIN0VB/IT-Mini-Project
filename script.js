
let currentUser = null; 
let currentQuizState = null; 
let masterTimerInterval = null;
const baseUrl = 'http://127.0.0.1:5000';

async function api(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: {},
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(baseUrl + url, options); 

        if (response.status === 204) {
            return null;
        }

        const data = await response.json();

        if (!response.ok) {

            throw new Error(data.error || data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error.message);

        showToast(`Error: ${error.message}`, 'error');
    
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('QuizVerse App Initializing...');

    document.getElementById('nav-to-register').addEventListener('click', (e) => { e.preventDefault(); navigateTo('page-register'); });
    document.getElementById('nav-to-login').addEventListener('click', (e) => { e.preventDefault(); navigateTo('page-login'); });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-button').addEventListener('click', handleSignOut);
    
    document.getElementById('nav-to-create-quiz').addEventListener('click', () => navigateTo('page-teacher-create-quiz'));
    document.getElementById('nav-back-to-teacher-dash').addEventListener('click', () => navigateTo('page-teacher-dashboard'));
    document.getElementById('nav-back-to-teacher-dash-2').addEventListener('click', () => navigateTo('page-teacher-dashboard'));
    
    
    document.getElementById('create-quiz-form').addEventListener('submit', handleCreateQuiz);
    document.getElementById('add-question-form').addEventListener('submit', handleAddQuestionManual);
    document.getElementById('upload-csv-button').addEventListener('click', handleUploadCSV);
    document.getElementById('delete-quiz-button')?.addEventListener('click', handleDeleteQuiz);


    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });
    
   
    document.getElementById('nav-back-to-student-dash').addEventListener('click', () => navigateTo('page-student-dashboard'));
    
 
    document.getElementById('next-question-button').addEventListener('click', handleNextQuestion);
    document.getElementById('finish-quiz-button').addEventListener('click', handleFinishQuiz);

  
    checkUserSession();
});

async function checkUserSession() {
    try {
        const data = await api('/api/session');
        currentUser = data;
        console.log('Active session found:', currentUser);
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('app-main').style.display = 'block';
        navigateTo(currentUser.role === 'teacher' ? 'page-teacher-dashboard' : 'page-student-dashboard');
    } catch (error) {
        console.log('No active session. User must log in.');
        navigateTo('page-login');
    }
 
    document.getElementById('loader').classList.remove('active');
}


async function handleRegister(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const role = e.target.role.value;
    
    try {
        const data = await api('/api/register', 'POST', { email, password, role });
        currentUser = data;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('app-main').style.display = 'block';
        navigateTo(currentUser.role === 'teacher' ? 'page-teacher-dashboard' : 'page-student-dashboard');
        showToast('Account created successfully!', 'success');
    } catch (error) {
        
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    
    try {
        const data = await api('/api/login', 'POST', { email, password });
        currentUser = data;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('app-main').style.display = 'block';
        navigateTo(currentUser.role === 'teacher' ? 'page-teacher-dashboard' : 'page-student-dashboard');
        showToast('Logged in successfully!', 'success');
    } catch (error) {
     
    }
}

async function handleSignOut() {
    try {
        await api('/api/logout', 'POST');
        currentUser = null;
        document.getElementById('app-main').style.display = 'none';
        navigateTo('page-login');
        showToast('Logged out successfully.', 'success');
    } catch (error) {

    }
}


function navigateTo(pageId) {
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    } else {
        console.error(`Page not found: ${pageId}`);
        document.getElementById('page-login').classList.add('active'); 
    }

    if (currentUser) {
        updateHeaderNav(pageId);
        
        loadPageData(pageId);
    }
    
    if (pageId === 'page-quiz-take') {
        document.getElementById('app-main').style.display = 'none';
    } else if (currentUser) {
        document.getElementById('app-main').style.display = 'block';
    }
}

function loadPageData(pageId) {
    switch(pageId) {
        case 'page-teacher-dashboard':
            loadTeacherQuizzes();
            break;
        case 'page-student-dashboard':
            loadStudentQuizzes();
            break;
    }
}
function updateHeaderNav(pageId) {
    const navContainer = document.getElementById('nav-links');
    let links = '';
    
    const baseClass = "nav-link";
    const activeClass = "nav-link-active";
    const inactiveClass = "nav-link-inactive";

    if (currentUser.role === 'teacher') {
        links = `
            <a href="#" class="${baseClass} ${pageId.startsWith('page-teacher-dashboard') ? activeClass : inactiveClass}" data-page="page-teacher-dashboard">Dashboard</a>
            <a href="#" class="${baseClass} ${pageId === 'page-teacher-create-quiz' ? activeClass : inactiveClass}" data-page="page-teacher-create-quiz">Create Quiz</a>
        `;
    } else {
        links = `
            <a href="#" class="${baseClass} ${pageId.startsWith('page-student-dashboard') ? activeClass : inactiveClass}" data-page="page-student-dashboard">Dashboard</a>
        `;
    }
    navContainer.innerHTML = links;
    
    navContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(e.target.dataset.page);
        });
    });
}

function handleTabClick(e) {
    e.preventDefault();
    const clickedTab = e.target;
    const tabName = clickedTab.dataset.tab;

 
    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.classList.remove('tab-active');
        tab.classList.add('tab-inactive');
    });
    clickedTab.classList.add('tab-active');
    clickedTab.classList.remove('tab-inactive');

  
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(`tab-${tabName}`).style.display = 'block';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = type === 'success' ? 'toast-success' : 'toast-error';
    

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function loadTeacherQuizzes() {
    try {
        const quizzes = await api('/api/quizzes');
        const listContainer = document.getElementById('teacher-quiz-list');
        listContainer.innerHTML = ''; 

        if (quizzes.length === 0) {
            listContainer.innerHTML = `<p class="empty-state">You haven't created any quizzes yet. Click "Create New Quiz" to start.</p>`;
            return;
        }

        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card-teacher';
            card.innerHTML = `
                <div>
                    <h3 class="quiz-card-title">${quiz.title}</h3>
                    <div class="quiz-card-meta">
                        <span><i data-lucide="calendar"></i> Starts: ${new Date(quiz.startTime).toLocaleString()}</span>
                        <span><i data-lucide="timer"></i> ${quiz.durationMinutes} min</span>
                        <span><i data-lucide="help-circle"></i> ${quiz.questionCount} Qs</span>
                    </div>
                </div>
                <div class="quiz-card-actions">
                    <button class="button-secondary" data-quiz-id="${quiz.id}">Manage</button>
                </div>
            `;
            
            card.querySelector('button').addEventListener('click', () => {
                loadQuizManagePage(quiz.id);
            });
            listContainer.appendChild(card);
        });
        lucide.createIcons(); 
    } catch (error) {
        console.error('Failed to load quizzes:', error);
    }
}

async function handleCreateQuiz(e) {
    e.preventDefault();
    const title = document.getElementById('quiz-title').value;
    const startTimeLocal = document.getElementById('quiz-start-time').value;
    const durationMinutes = document.getElementById('quiz-duration').value;

    const startTimeUTC = new Date(startTimeLocal).toISOString();

    try {
        await api('/api/quizzes', 'POST', {
            title,
            startTime: startTimeUTC,
            durationMinutes
        });
        showToast('Quiz created successfully!', 'success');
        navigateTo('page-teacher-dashboard'); 
        e.target.reset(); 
    } catch (error) {
       
    }
}

async function loadQuizManagePage(quizId) {
    try {
        const data = await api(`/api/quizzes/${quizId}`);
        
        
        document.getElementById('manage-quiz-id').value = quizId;
        
        
        document.getElementById('manage-quiz-title').textContent = `Manage: ${data.title}`;

        
        renderQuestionList(data.questions);

        
        renderResultsList(data.results);
        
        
        renderProctorLogs(data.proctorLogs);
        
        
        navigateTo('page-teacher-manage-quiz');
        
        
        document.querySelectorAll('.tab-link')[0].click();


        lucide.createIcons(); 

    } catch (error) {
        console.error('Failed to load quiz details:', error);
    }
}

function renderQuestionList(questions) {
    const list = document.getElementById('question-list-container');
    list.innerHTML = '';
    document.getElementById('current-question-count').textContent = questions.length;
    if (questions.length === 0) {
        list.innerHTML = `<p class="empty-state-small">No questions added yet.</p>`;
        return;
    }
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-list-item';
        item.innerHTML = `
            <strong>Q${index + 1}: ${q.text}</strong>
            <span class="correct-answer">Correct: ${q.correctAnswer}</span>
        `;
        list.appendChild(item);
    });
}

function renderResultsList(results) {
    const list = document.getElementById('results-list');
    list.innerHTML = '';
    if (results.length === 0) {
        list.innerHTML = `<p class="empty-state-small">No students have completed this quiz yet.</p>`;
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Finished At</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');
    results.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${r.studentEmail}</td>
            <td>${r.score} / ${r.totalQuestions}</td>
            <td>${r.finishedAt ? new Date(r.finishedAt).toLocaleString() : 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
    list.appendChild(table);
}

function renderProctorLogs(logs) {
    const list = document.getElementById('proctor-log-list');
    list.innerHTML = '';
    if (logs.length === 0) {
        list.innerHTML = `<p class="empty-state-small">No proctoring events have been logged.</p>`;
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Student</th>
                <th>Event Type</th>
                <th>At Question</th>
                <th>Timestamp</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.studentEmail}</td>
            <td><span class="log-event">${log.eventType}</span></td>
            <td>${log.questionNumber}</td>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
    list.appendChild(table);
}

async function handleAddQuestionManual(e) {
    e.preventDefault();
    const quizId = document.getElementById('manage-quiz-id').value;
    const questionData = {
        text: document.getElementById('question-text').value,
        options: {
            A: document.getElementById('option-a').value,
            B: document.getElementById('option-b').value,
            C: document.getElementById('option-c').value,
            D: document.getElementById('option-d').value,
        },
        correctAnswer: document.getElementById('correct-answer').value,
    };

    try {
        await api(`/api/quizzes/${quizId}/questions/manual`, 'POST', questionData);
        showToast('Question added!', 'success');
        e.target.reset(); 
        loadQuizManagePage(quizId);
    } catch (error) {
        
    }
}

async function handleUploadCSV() {
    const quizId = document.getElementById('manage-quiz-id').value;
    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput.files[0];
    const statusEl = document.getElementById('upload-status');
    
    if (!file) {
        showToast('Please select a CSV file first.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    statusEl.textContent = 'Uploading...';
    try {
        
        const response = await fetch(`${baseUrl}/api/quizzes/${quizId}/questions/csv`, {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload CSV');
        }

        showToast(data.message, 'success');
        statusEl.textContent = data.message;
        fileInput.value = ''; 
        loadQuizManagePage(quizId);

    } catch (error) {
        console.error('CSV Upload Error:', error);
        statusEl.textContent = `Error: ${error.message}`;
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function handleDeleteQuiz() {
    const quizId = document.getElementById('manage-quiz-id').value;
    
    if (!quizId) {
        showToast('Could not find quiz ID.', 'error');
        return;
    }

    if (!confirm('Are you absolutely sure you want to delete this quiz? This will also delete all associated questions, attempts, and logs. This action cannot be undone.')) {
        return; 
    }

    try {
        
        await api(`/api/quizzes/${quizId}`, 'DELETE');
        
        showToast('Quiz deleted successfully.', 'success');
        
        
        navigateTo('page-teacher-dashboard');

    } catch (error) {
       
        console.error('Failed to delete quiz:', error);
    }
}

async function loadStudentQuizzes() {
    try {
        const quizzes = await api('/api/student/quizzes');
        const listContainer = document.getElementById('student-quiz-list');
        listContainer.innerHTML = '';

        if (quizzes.length === 0) {
            listContainer.innerHTML = `<p class="empty-state">No quizzes are available at this time.</p>`;
            return;
        }

        const now = new Date();
        quizzes.forEach(quiz => {
            const card = document.createElement('div');
            card.className = 'quiz-card-student';
            
            const startTime = new Date(quiz.startTime);
            const canStart = now >= startTime;
            let buttonHtml = '';
            let statusHtml = '';

            if (quiz.attempt && quiz.attempt.finished) {
              
                const score = quiz.attempt.score;
                const total = quiz.attempt.totalQuestions;
                const percent = total > 0 ? Math.round((score / total) * 100) : 0;
                statusHtml = `<div class="quiz-completed">Completed! Score: ${score}/${total} (${percent}%)</div>`;
                buttonHtml = `<button class="button-disabled" disabled>Completed</button>`;
            } else if (canStart) {
                
                statusHtml = `<div class="quiz-ready">Ready to start!</div>`;
                buttonHtml = `<button class="button-primary" data-quiz-id="${quiz.id}">Start Quiz</button>`;
            } else {
                
                statusHtml = `<div class_locked">Locked until: ${startTime.toLocaleString()}</div>`;
                buttonHtml = `<button class="button-disabled" disabled>Locked</button>`;
            }

            card.innerHTML = `
                <div>
                    <h3 class="quiz-card-title">${quiz.title}</h3>
                    <div class="quiz-card-meta">
                        <span><i data-lucide="timer"></i> ${quiz.durationMinutes} min</span>
                        <span><i data-lucide="help-circle"></i> ${quiz.questionCount} Qs</span>
                    </div>
                </div>
                <div class="quiz-card-actions">
                    ${statusHtml}
                    ${buttonHtml}
                </div>
            `;

            const startButton = card.querySelector('.button-primary');
            if (startButton) {
                startButton.addEventListener('click', () => {
                    if (confirm('Are you sure you want to start this quiz? You cannot restart, and the timer will begin immediately.')) {
                        startQuiz(quiz.id);
                    }
                });
            }
            listContainer.appendChild(card);
        });
        lucide.createIcons(); 
    } catch (error) {
        console.error('Failed to load student quizzes:', error);
    }
}

async function startQuiz(quizId) {
    try {
        const data = await api(`/api/student/quiz/${quizId}/start`, 'POST');

        currentQuizState = {
            quizId: quizId,
            attemptId: data.attemptId,
            questions: data.questions,
            answers: {}, 
            currentQuestionIndex: 0,
            quizEndTime: Date.now() + (data.duration * 60 * 1000)
        };

        
        document.getElementById('quiz-take-title').textContent = data.quizTitle;
        document.getElementById('question-total-num').textContent = data.questions.length;
        
      
        navigateTo('page-quiz-take');

        
        startMasterTimer();
        
        
        renderCurrentQuestion();

       
        addProctoringListeners();

    } catch (error) {
        showToast(`Failed to start quiz: ${error.message}`, 'error');
    }
}

function renderCurrentQuestion() {
    if (!currentQuizState) return;
    const state = currentQuizState;
    const q = state.questions[state.currentQuestionIndex];
    
    document.getElementById('question-take-text').textContent = q.text;
    document.getElementById('question-current-num').textContent = state.currentQuestionIndex + 1;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    ['A', 'B', 'C', 'D'].forEach(key => {
        const optionText = q.options[key];
        const optionEl = document.createElement('button');
        optionEl.className = 'quiz-option-button';
        optionEl.dataset.option = key;
        
        optionEl.innerHTML = `
            <span class="option-key">${key}</span>
            <span class="option-text">${optionText}</span>
            <span class="locked-indicator">
                <i data-lucide="check-circle" class="w-5 h-5"></i>
                Selected
            </span>
        `;

        if (state.answers[q.id] === key) {
            optionEl.classList.add('selected');
        }

        optionEl.addEventListener('click', () => {
 
            optionsContainer.querySelectorAll('.quiz-option-button').forEach(btn => {
                btn.classList.remove('selected');
            });

            optionEl.classList.add('selected');

            state.answers[q.id] = key;
        });
        
        optionsContainer.appendChild(optionEl);
    });

    const nextButton = document.getElementById('next-question-button');
    const finishButton = document.getElementById('finish-quiz-button');
    
    if (state.currentQuestionIndex === state.questions.length - 1) {

        nextButton.style.display = 'none';
        finishButton.style.display = 'block';
    } else {

        nextButton.style.display = 'block';
        finishButton.style.display = 'none';
    }


    lucide.createIcons();
}

function handleNextQuestion() {
    if (!currentQuizState) return;
    currentQuizState.currentQuestionIndex++;
    renderCurrentQuestion();
}


async function handleFinishQuiz() {
    if (!currentQuizState) return;
    if (!confirm('Are you sure you want to submit your quiz?')) {
        return;
    }
    
 
    stopMasterTimer();
    removeProctoringListeners();

    const state = currentQuizState;
    
    try {
        const result = await api(`/api/student/quiz/${state.quizId}/submit`, 'POST', {
            answers: state.answers
        });

        
        showResultPage(result.score, result.totalQuestions);
        
    } catch (error) {
        showToast(`Failed to submit quiz: ${error.message}`, 'error');
     
        navigateTo('page-student-dashboard');
    } finally {
        currentQuizState = null; 
    }
}


function showResultPage(score, total) {
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    document.getElementById('final-score').textContent = `${score} / ${total}`;
    document.getElementById('final-score-percent').textContent = `(${percent}%)`;
    navigateTo('page-student-result');
}

function startMasterTimer() {
    const timerEl = document.getElementById('quiz-timer');
    
    const updateTimer = () => {
        if (!currentQuizState) { 
             stopMasterTimer();
             return;
        }
        const now = Date.now();
        const remainingMs = currentQuizState.quizEndTime - now;
        
        if (remainingMs <= 0) {
            
            stopMasterTimer();
            timerEl.textContent = '00:00';
            showToast("Time's up! Automatically submitting your quiz.", 'error');
            handleFinishQuiz(); 
            return;
        }
        
        const remainingSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    

    if (masterTimerInterval) {
        clearInterval(masterTimerInterval);
    }
    
    updateTimer(); 
    masterTimerInterval = setInterval(updateTimer, 1000);
}

function stopMasterTimer() {
    if (masterTimerInterval) {
        clearInterval(masterTimerInterval);
        masterTimerInterval = null;
    }
}

function handleProctoringEvent() {
    if (!currentQuizState) return; 
    
    console.log('FOCUS LOST! Logging event...');
    
    const state = currentQuizState;
    api(`/api/student/quiz/${state.quizId}/log`, 'POST', {
        eventType: 'focus_lost',
        questionNumber: state.currentQuestionIndex + 1
    }).catch(err => {

        console.error('Failed to log proctoring event:', err);
    });
}

function addProctoringListeners() {
    console.log('Proctoring enabled.');
    window.addEventListener('blur', handleProctoringEvent);
}

function removeProctoringListeners() {
    console.log('Proctoring disabled.');
    window.removeEventListener('blur', handleProctoringEvent);

}
