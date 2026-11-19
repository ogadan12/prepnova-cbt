// ==========================================
// PREPNOVA CBT - MAIN APPLICATION
// ==========================================

const SUBJECTS = ["Biology", "Chemistry", "Physics", "English"];

const SCREENS = [
    "landingPage", "accessScreen", "dashboard",
    "setupScreen", "examScreen", "resultScreen", "reviewScreen"
];

const SETTINGS = window.CONFIG || {};

let currentSubject = "";
let currentMode = "practice";
let currentQuestion = 0;
let answers = {};
let timerInterval = null;
let timeRemaining = 0;
let examSubmitted = false;
let currentQuestions = [];
let starting = false;


// ==========================================
// SAMPLE QUESTIONS (used until a subject's
// encrypted file data/<subject>.enc.json exists)
// Add  fixed: true  to a question to stop its
// options being shuffled ("All of the above").
// ==========================================

const QUESTION_BANK = {

    Biology: [
        {
            question: "Which organelle is responsible for energy production in a cell?",
            options: ["Ribosome", "Mitochondrion", "Nucleus", "Vacuole"],
            answer: 1,
            explanation: "The mitochondrion is responsible for aerobic respiration and energy production in the cell."
        },
        {
            question: "The basic structural and functional unit of life is the?",
            options: ["Tissue", "Organ", "Cell", "System"],
            answer: 2,
            explanation: "The cell is the basic structural and functional unit of living organisms."
        },
        {
            question: "Which of these is responsible for photosynthesis?",
            options: ["Chloroplast", "Mitochondrion", "Ribosome", "Lysosome"],
            answer: 0,
            explanation: "Chloroplasts contain chlorophyll, which absorbs light energy for photosynthesis."
        }
    ],

    Chemistry: [
        {
            question: "The smallest particle of an element that retains its chemical properties is the?",
            options: ["Molecule", "Atom", "Compound", "Mixture"],
            answer: 1,
            explanation: "An atom is the smallest unit of an element that retains its chemical identity."
        },
        {
            question: "What is the chemical symbol for sodium?",
            options: ["S", "So", "Na", "N"],
            answer: 2,
            explanation: "The chemical symbol for sodium is Na."
        },
        {
            question: "A substance with a pH below 7 is generally?",
            options: ["Acidic", "Alkaline", "Neutral", "Metallic"],
            answer: 0,
            explanation: "Acids have pH values below 7 under ordinary conditions."
        }
    ],

    Physics: [
        {
            question: "What is the SI unit of force?",
            options: ["Joule", "Newton", "Watt", "Pascal"],
            answer: 1,
            explanation: "The SI unit of force is the newton (N)."
        },
        {
            question: "Which instrument is used to measure electric current?",
            options: ["Voltmeter", "Thermometer", "Ammeter", "Barometer"],
            answer: 2,
            explanation: "An ammeter measures electric current in a circuit."
        },
        {
            question: "The rate of change of velocity with time is called?",
            options: ["Speed", "Acceleration", "Distance", "Momentum"],
            answer: 1,
            explanation: "Acceleration is the rate of change of velocity with time."
        }
    ],

    English: [
        {
            question: "Choose the correctly spelt word.",
            options: ["Accomodation", "Acommodation", "Accommodation", "Acomodation"],
            answer: 2,
            explanation: "Accommodation is spelt with double c and double m."
        },
        {
            question: "Choose the opposite of the word 'Ancient'.",
            options: ["Old", "Modern", "Historic", "Traditional"],
            answer: 1,
            explanation: "Modern means relating to the present or recent times."
        },
        {
            question: "Identify the noun in this sentence: 'The boy kicked the ball.'",
            options: ["Kicked", "The", "Boy", "Quickly"],
            answer: 2,
            explanation: "Boy is a noun because it names a person."
        }
    ]

};


// ==========================================
// SCREEN HELPERS
// ==========================================

function hideAll() {
    SCREENS.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
}

function show(id) {
    hideAll();
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
    window.scrollTo(0, 0);
}

function setMessage(text, type) {
    const box = document.getElementById("accessMessage");
    if (!box) return;
    box.textContent = text || "";
    box.className = "message" + (type ? " " + type : "");
}

function showLanding() {
    show("landingPage");
}

function showAccess(event) {
    if (event && event.preventDefault) event.preventDefault();
    setMessage("");
    show("accessScreen");
    const input = document.getElementById("accessCode");
    if (input) input.focus();
}

function showDashboard() {
    stopTimer();
    updateDashboard();
    show("dashboard");
}


// ==========================================
// ACCESS
// ==========================================

function hasSubject(subject) {
    return !!(window.Access && Access.has(subject));
}

function checkAccess() {
    return SUBJECTS.some(hasSubject);
}

// Show a lock on subjects the student's code does not include.
function updateDashboard() {
    document.querySelectorAll(".dash-subject").forEach(function (btn) {
        const match = (btn.getAttribute("onclick") || "").match(/'([^']+)'/);
        if (!match) return;

        const unlocked = hasSubject(match[1]);
        btn.classList.toggle("locked", !unlocked);

        const arrow = btn.querySelector("b");
        if (arrow) arrow.textContent = unlocked ? "→" : "🔒";
    });
}

async function submitAccessCode(event) {
    event.preventDefault();

    const input = document.getElementById("accessCode");
    const button = event.target.querySelector("button[type=submit]");

    if (!window.Access) {
        setMessage("Access system failed to load. Refresh the page.", "error");
        return;
    }

    button.disabled = true;
    setMessage("Checking code...", "");

    try {
        const result = await Access.redeem(input.value);
        setMessage("Access granted: " + result.subjects.join(", "), "success");
        input.value = "";
        setTimeout(showDashboard, 700);
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
}


// ==========================================
// SHUFFLING (new order on every attempt)
// ==========================================

function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function prepareQuestions(list) {
    return shuffle(list).map(function (q) {
        const order = q.fixed
            ? q.options.map(function (_, i) { return i; })
            : shuffle(q.options.map(function (_, i) { return i; }));

        return {
            question: q.question,
            options: order.map(function (i) { return q.options[i]; }),
            answer: order.indexOf(q.answer),
            explanation: q.explanation || ""
        };
    });
}

// Encrypted file first, sample questions only if no file exists yet.
// Returns null if a file exists but cannot be unlocked.
async function loadQuestions(subject) {

    let response = null;

    try {
        response = await fetch(
            "data/" + subject.toLowerCase() + ".enc.json?t=" + Date.now(),
            { cache: "no-store" }
        );
    } catch (error) {
        response = null;
    }

    if (response && response.ok) {
        try {
            const blob = await response.json();
            const data = await Access.decrypt(Access.getKey(subject), blob);
            if (Array.isArray(data) && data.length) return data;
        } catch (error) {
            alert("These questions could not be unlocked. Please contact the administrator.");
            return null;
        }
    }

    return QUESTION_BANK[subject] || [];
}


// ==========================================
// SUBJECT SELECTION
// ==========================================

function selectSubject(subject) {

    if (!hasSubject(subject)) {
        showAccess();
        setMessage(
            checkAccess()
                ? "Your code does not include " + subject + ". Enter a code that does."
                : "Enter your access code to continue.",
            "error"
        );
        return;
    }

    currentSubject = subject;

    document.getElementById("setupSubject").textContent = subject;

    show("setupScreen");
}


// ==========================================
// START EXAMINATION
// ==========================================

async function startExam(mode) {

    if (starting) return;

    if (!hasSubject(currentSubject)) {
        showAccess();
        return;
    }

    starting = true;

    try {
        const list = await loadQuestions(currentSubject);

        if (list === null) return;

        if (list.length === 0) {
            alert("No questions available for this subject yet.");
            return;
        }

        currentMode = mode || "practice";
        currentQuestion = 0;
        answers = {};
        examSubmitted = false;
        currentQuestions = prepareQuestions(list);

        document.getElementById("examSubject").textContent = currentSubject;

        show("examScreen");

        if (currentMode === "exam") {
            timeRemaining = Number(SETTINGS.examDuration || 60) * 60;
            startTimer();
        } else {
            stopTimer();
            document.getElementById("examTimer").textContent = "PRACTICE";
        }

        renderQuestion();
        renderPalette();

    } finally {
        starting = false;
    }
}


// ==========================================
// DISPLAY QUESTION
// ==========================================

function renderQuestion() {

    const question = currentQuestions[currentQuestion];

    if (!question) return;

    const total = currentQuestions.length;

    document.getElementById("questionNumber").textContent =
        "Question " + (currentQuestion + 1);

    document.getElementById("questionCount").textContent = "of " + total;

    document.getElementById("questionText").textContent = question.question;

    document.getElementById("questionProgress").style.width =
        ((currentQuestion + 1) / total * 100) + "%";

    const container = document.getElementById("optionsContainer");

    container.innerHTML = "";

    const picked = answers[currentQuestion];

    question.options.forEach(function (option, index) {

        const button = document.createElement("button");
        button.type = "button";
        button.className = "option";

        const letter = document.createElement("span");
        letter.className = "option-letter";
        letter.textContent = String.fromCharCode(65 + index);

        const text = document.createElement("span");
        text.textContent = option;

        button.append(letter, text);

        if (picked === index) {
            button.classList.add("selected");
        }

        // Practice mode shows feedback straight away
        if (currentMode === "practice" && picked !== undefined) {

            if (index === question.answer) {
                button.classList.add("correct");
            }

            if (index === picked && picked !== question.answer) {
                button.classList.add("wrong");
            }
        }

        button.addEventListener("click", function () {

            if (examSubmitted) return;

            // Practice mode: first answer is final
            if (currentMode === "practice" && answers[currentQuestion] !== undefined) return;

            answers[currentQuestion] = index;

            renderQuestion();
            renderPalette();
        });

        container.appendChild(button);
    });

    document.getElementById("previousBtn").disabled = currentQuestion === 0;

    document.getElementById("nextBtn").textContent =
        currentQuestion === total - 1 ? "Finish →" : "Next →";
}


// ==========================================
// QUESTION NAVIGATION
// ==========================================

function nextQuestion() {

    if (currentQuestion === currentQuestions.length - 1) {
        submitExam();
        return;
    }

    currentQuestion++;
    renderQuestion();
    renderPalette();
}

function previousQuestion() {

    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
        renderPalette();
    }
}


// ==========================================
// QUESTION PALETTE
// ==========================================

function renderPalette() {

    const palette = document.getElementById("questionPalette");

    palette.innerHTML = "";

    currentQuestions.forEach(function (question, index) {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "palette-number";
        button.textContent = index + 1;

        if (answers[index] !== undefined) button.classList.add("answered");
        if (index === currentQuestion) button.classList.add("current");

        button.addEventListener("click", function () {
            currentQuestion = index;
            renderQuestion();
            renderPalette();
        });

        palette.appendChild(button);
    });
}


// ==========================================
// EXAMINATION TIMER
// ==========================================

function startTimer() {

    stopTimer();
    updateTimer();

    timerInterval = setInterval(function () {

        timeRemaining--;
        updateTimer();

        if (timeRemaining <= 0) {
            stopTimer();
            submitExam(true);
        }

    }, 1000);
}

function updateTimer() {

    const safe = Math.max(timeRemaining, 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;

    document.getElementById("examTimer").textContent =
        String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function stopTimer() {

    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}


// ==========================================
// SUBMIT EXAMINATION
// ==========================================

function submitExam(auto) {

    if (examSubmitted) return;

    if (!auto) {

        const unanswered =
            currentQuestions.length - Object.keys(answers).length;

        const confirmed = confirm(
            "Are you sure you want to submit?\n" +
            "Unanswered questions: " + unanswered
        );

        if (!confirmed) return;
    }

    examSubmitted = true;

    stopTimer();

    calculateResults();
}


// ==========================================
// CALCULATE RESULTS
// ==========================================

function calculateResults() {

    let correct = 0;

    currentQuestions.forEach(function (question, index) {
        if (answers[index] === question.answer) correct++;
    });

    const total = currentQuestions.length;
    const wrong = total - correct;
    const percentage = Math.round((correct / total) * 100);

    show("resultScreen");

    document.getElementById("resultPercentage").textContent = percentage + "%";
    document.getElementById("correctCount").textContent = correct;
    document.getElementById("wrongCount").textContent = wrong;
    document.getElementById("totalCount").textContent = total;

    let message = "Keep practising! You can improve.";

    if (percentage >= 80) {
        message = "Excellent performance! Keep it up.";
    } else if (percentage >= 60) {
        message = "Good work! Keep improving.";
    } else if (percentage >= 40) {
        message = "You're making progress. Practise more.";
    }

    document.getElementById("resultMessage").textContent = message;
}


// ==========================================
// REVIEW ANSWERS
// ==========================================

function reviewAnswers() {

    show("reviewScreen");

    const container = document.getElementById("reviewContainer");

    container.innerHTML = "";

    currentQuestions.forEach(function (question, index) {

        const selected = answers[index];
        const correct = question.answer;

        const item = document.createElement("div");
        item.className = "review-item";

        const heading = document.createElement("h3");
        heading.textContent = (index + 1) + ". " + question.question;

        const yourAnswer = document.createElement("p");
        yourAnswer.textContent =
            "Your answer: " +
            (selected === undefined ? "Not answered" : question.options[selected]);
        yourAnswer.className =
            selected === correct ? "correct-answer" : "wrong-answer";

        const correctAnswer = document.createElement("p");
        correctAnswer.textContent = "Correct answer: " + question.options[correct];
        correctAnswer.className = "correct-answer";

        const explanation = document.createElement("p");
        explanation.textContent = "Explanation: " + question.explanation;

        item.append(heading, yourAnswer, correctAnswer, explanation);

        container.appendChild(item);
    });
}


// ==========================================
// LOGOUT
// ==========================================

function logout() {

    if (!confirm("Log out? You will need your access code again.")) return;

    if (window.Access) Access.clear();

    stopTimer();

    showLanding();
}


// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", function () {

    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();

    const whatsapp = document.getElementById("whatsappLink");
    if (whatsapp && SETTINGS.whatsappNumber) {
        whatsapp.href = "https://wa.me/" + SETTINGS.whatsappNumber;
    }

    const form = document.getElementById("accessForm");
    if (form) form.addEventListener("submit", submitAccessCode);

    document.getElementById("nextBtn").addEventListener("click", nextQuestion);
    document.getElementById("previousBtn").addEventListener("click", previousQuestion);

    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", function () {
            navLinks.classList.toggle("active");
        });

        navLinks.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                navLinks.classList.remove("active");
            });
        });
    }

    if (checkAccess()) {
        showDashboard();
    } else {
        showLanding();
    }
});
