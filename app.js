/**
 * Marrow PYQ Flashcards & Question Bank
 * Pure Vanilla JavaScript Client Application
 * Mobile-First & Responsive
 */

(function () {
    'use strict';

    // Application State
    const state = {
        subjectsMeta: null,
        currentSubjectSlug: '',
        currentSubjectName: '',
        allQuestions: [],
        filteredQuestions: [],
        currentIndex: 0,
        mode: 'flashcard', // 'flashcard' | 'quiz' | 'list'
        examFilter: 'all',
        yearFilter: 'all',
        showOnlyBookmarked: false,
        isRevealed: false,
        bookmarks: new Set(JSON.parse(localStorage.getItem('marrow_pyq_bookmarks') || '[]')),
        quizScore: {
            correct: 0,
            attempted: 0,
            answers: {} // cardId: { selectedIndex, isCorrect }
        },
        searchIndex: null,
        theme: localStorage.getItem('marrow_pyq_theme') || 'light'
    };

    // DOM Elements
    const elements = {
        app: document.getElementById('app'),
        logoHomeBtn: document.getElementById('logoHomeBtn'),
        subjectSelect: document.getElementById('subjectSelect'),
        yearSelect: document.getElementById('yearSelect'),
        filterPills: document.querySelectorAll('.filter-pill'),
        modeTabs: document.querySelectorAll('.mode-tab'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        bookmarkedBtn: document.getElementById('bookmarkedBtn'),
        bookmarkCount: document.getElementById('bookmarkCount'),
        pdfDownloadsModalBtn: document.getElementById('pdfDownloadsModalBtn'),
        printBtn: document.getElementById('printBtn'),

        // Mobile Bottom Navigation
        mobileBottomNav: document.getElementById('mobileBottomNav'),
        bNavItems: document.querySelectorAll('.b-nav-item'),
        bNavBookmarkBadge: document.getElementById('bNavBookmarkBadge'),

        // Search
        searchContainer: document.getElementById('searchContainer'),
        mobileSearchToggleBtn: document.getElementById('mobileSearchToggleBtn'),
        globalSearchInput: document.getElementById('globalSearchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        searchResultsSection: document.getElementById('searchResultsSection'),
        searchResultsList: document.getElementById('searchResultsList'),
        searchResultCount: document.getElementById('searchResultCount'),
        closeSearchBtn: document.getElementById('closeSearchBtn'),

        // Views
        homeSection: document.getElementById('homeSection'),
        subjectsGrid: document.getElementById('subjectsGrid'),
        studySection: document.getElementById('studySection'),
        singleCardView: document.getElementById('singleCardView'),
        listView: document.getElementById('listView'),

        // Deck Bar
        currentSubjectTag: document.getElementById('currentSubjectTag'),
        deckFilterInfo: document.getElementById('deckFilterInfo'),
        deckCounter: document.getElementById('deckCounter'),
        deckProgressBar: document.getElementById('deckProgressBar'),
        starCurrentBtn: document.getElementById('starCurrentBtn'),
        shuffleBtn: document.getElementById('shuffleBtn'),
        shortcutsBtn: document.getElementById('shortcutsBtn'),

        // Quiz Tracker
        quizScoreTracker: document.getElementById('quizScoreTracker'),
        quizScoreValue: document.getElementById('quizScoreValue'),
        quizPercentage: document.getElementById('quizPercentage'),
        resetQuizBtn: document.getElementById('resetQuizBtn'),

        // Flashcard Elements
        flashcard: document.getElementById('flashcard'),
        cardExamBadge: document.getElementById('cardExamBadge'),
        cardIdBadge: document.getElementById('cardIdBadge'),
        cardImageBadge: document.getElementById('cardImageBadge'),
        cardQNumberDisplay: document.getElementById('cardQNumberDisplay'),
        cardQuestionBody: document.getElementById('cardQuestionBody'),
        cardOptionsList: document.getElementById('cardOptionsList'),
        revealAnswerWrap: document.getElementById('revealAnswerWrap'),
        revealAnswerBtn: document.getElementById('revealAnswerBtn'),
        cardExplanationBox: document.getElementById('cardExplanationBox'),
        correctAnswerText: document.getElementById('correctAnswerText'),
        cardExplanationContent: document.getElementById('cardExplanationContent'),
        cardReferencesBox: document.getElementById('cardReferencesBox'),
        cardReferencesText: document.getElementById('cardReferencesText'),

        // Nav Buttons
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        bottomCardIndex: document.getElementById('bottomCardIndex'),
        bottomTotalCards: document.getElementById('bottomTotalCards'),

        // List View
        listItemsContainer: document.getElementById('listItemsContainer'),
        listCount: document.getElementById('listCount'),
        expandAllExplanationsBtn: document.getElementById('expandAllExplanationsBtn'),
        collapseAllExplanationsBtn: document.getElementById('collapseAllExplanationsBtn'),

        // Modals
        imageLightbox: document.getElementById('imageLightbox'),
        lightboxImg: document.getElementById('lightboxImg'),
        lightboxCaption: document.getElementById('lightboxCaption'),
        closeLightboxBtn: document.getElementById('closeLightboxBtn'),
        pdfModal: document.getElementById('pdfModal'),
        closePdfModalBtn: document.getElementById('closePdfModalBtn'),
        pdfDownloadList: document.getElementById('pdfDownloadList'),
        shortcutsModal: document.getElementById('shortcutsModal'),
        closeShortcutsModalBtn: document.getElementById('closeShortcutsModalBtn')
    };

    // Initialize App
    async function init() {
        applyTheme(state.theme);
        updateBookmarkCountBadge();
        bindEvents();

        try {
            const resp = await fetch('data/subjects.json');
            if (!resp.ok) throw new Error('Failed to load subjects index');
            state.subjectsMeta = await resp.json();
            populateSubjectsUI(state.subjectsMeta.subjects);
            
            // Check URL query parameters (e.g. ?sub=anatomy&q=123)
            const urlParams = new URLSearchParams(window.location.search);
            const subParam = urlParams.get('sub');
            if (subParam) {
                await loadSubject(subParam);
            } else {
                showHomeView();
            }
        } catch (err) {
            console.error('Initialization error:', err);
            elements.subjectsGrid.innerHTML = `
                <div style="grid-column: 1/-1; padding: 20px; background: #fee2e2; color: #991b1b; border-radius: 8px;">
                    Failed to load subjects data. Please refresh or check connection.
                </div>
            `;
        }
    }

    // Theme Switcher
    function applyTheme(theme) {
        state.theme = theme;
        if (theme === 'dark') {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
        }
        localStorage.setItem('marrow_pyq_theme', theme);
    }

    function toggleTheme() {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    }

    // Subjects Grid & Select Dropdown
    function populateSubjectsUI(subjects) {
        // Dropdown
        elements.subjectSelect.innerHTML = '<option value="">-- All Subjects --</option>';
        subjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.slug;
            opt.textContent = `${sub.name} (${sub.count} Qs)`;
            elements.subjectSelect.appendChild(opt);
        });

        // Grid on Home
        elements.subjectsGrid.innerHTML = '';
        subjects.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.dataset.slug = sub.slug;
            
            const initials = sub.name.substring(0, 2).toUpperCase();
            card.innerHTML = `
                <div class="subject-card-top">
                    <div class="subject-icon-wrap">${initials}</div>
                    <span class="subject-count-pill">${sub.count} Qs</span>
                </div>
                <div class="subject-card-name">${sub.name}</div>
                <div class="subject-card-exams">NEET PG &bull; INI-CET &bull; AIIMS</div>
            `;
            card.addEventListener('click', () => {
                loadSubject(sub.slug);
            });
            elements.subjectsGrid.appendChild(card);
        });

        // PDF Downloads Modal Grid
        elements.pdfDownloadList.innerHTML = '';
        subjects.forEach(sub => {
            const item = document.createElement('a');
            item.className = 'pdf-download-link';
            item.href = `pdfs/${sub.slug}_PYQ.pdf`;
            item.download = `${sub.slug}_PYQ.pdf`;
            item.target = '_blank';
            item.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <span>${sub.name} (${sub.count} Qs)</span>
            `;
            elements.pdfDownloadList.appendChild(item);
        });
    }

    function showHomeView() {
        elements.homeSection.style.display = 'block';
        elements.studySection.style.display = 'none';
        elements.subjectSelect.value = '';
        state.showOnlyBookmarked = false;
        updateNavState('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Load Subject Data
    async function loadSubject(slug, targetCardId = null) {
        if (!slug) {
            showHomeView();
            return;
        }

        try {
            elements.homeSection.style.display = 'none';
            elements.studySection.style.display = 'block';
            elements.cardQuestionBody.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-light);">Loading questions...</div>';

            const resp = await fetch(`data/${slug}.json`);
            if (!resp.ok) throw new Error(`Could not load ${slug}.json`);
            const data = await resp.json();

            state.currentSubjectSlug = slug;
            state.currentSubjectName = data.subject;
            state.allQuestions = data.questions;
            elements.subjectSelect.value = slug;
            elements.currentSubjectTag.textContent = data.subject;

            // Apply filters
            applyFilters();

            // If a specific card ID was requested (e.g. from search)
            if (targetCardId) {
                const foundIdx = state.filteredQuestions.findIndex(q => q.id === targetCardId);
                if (foundIdx !== -1) {
                    state.currentIndex = foundIdx;
                }
            } else {
                state.currentIndex = 0;
            }

            renderCurrentView();
            updateNavState(state.mode);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error('Error loading subject:', err);
            alert('Failed to load subject data. Please check connection or file path.');
        }
    }

    // Synchronize Desktop and Mobile Nav active states
    function updateNavState(activeType) {
        // Desktop Mode Tabs
        elements.modeTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.mode === activeType);
        });

        // Mobile Bottom Nav items
        elements.bNavItems.forEach(item => {
            const bnav = item.dataset.bnav;
            if (activeType === 'home') {
                item.classList.toggle('active', bnav === 'home');
            } else if (state.showOnlyBookmarked) {
                item.classList.toggle('active', bnav === 'bookmarks');
            } else {
                item.classList.toggle('active', bnav === activeType);
            }
        });
    }

    // Filters
    function applyFilters() {
        let qs = [...state.allQuestions];

        // Exam filter
        if (state.examFilter !== 'all') {
            qs = qs.filter(q => q.exam_type === state.examFilter);
        }

        // Year filter
        if (state.yearFilter !== 'all') {
            const yr = parseInt(state.yearFilter, 10);
            qs = qs.filter(q => q.year === yr);
        }

        // Bookmark filter
        if (state.showOnlyBookmarked) {
            qs = qs.filter(q => state.bookmarks.has(q.id));
        }

        state.filteredQuestions = qs;
        state.currentIndex = 0;

        // Update filter info text
        let filterDesc = [];
        if (state.examFilter !== 'all') filterDesc.push(state.examFilter);
        if (state.yearFilter !== 'all') filterDesc.push(state.yearFilter);
        if (state.showOnlyBookmarked) filterDesc.push('⭐ Bookmarked');

        elements.deckFilterInfo.textContent = filterDesc.length > 0 ? filterDesc.join(' • ') : 'All Questions';
    }

    // Set Mode (Flashcard, Quiz, List)
    async function setMode(newMode) {
        state.mode = newMode;
        state.isRevealed = false;

        // If currently on Home, load the first subject (e.g. anatomy or anaesthesia)
        if (elements.homeSection.style.display !== 'none' || !state.currentSubjectSlug) {
            const defaultSlug = (state.subjectsMeta && state.subjectsMeta.subjects.length > 0) 
                ? state.subjectsMeta.subjects[0].slug 
                : 'anaesthesia';
            await loadSubject(defaultSlug);
        }

        renderCurrentView();
        updateNavState(newMode);
    }

    // Render Current View
    function renderCurrentView() {
        if (state.mode === 'list') {
            elements.singleCardView.style.display = 'none';
            elements.listView.style.display = 'block';
            elements.quizScoreTracker.style.display = 'none';
            renderListView();
        } else {
            elements.singleCardView.style.display = 'block';
            elements.listView.style.display = 'none';
            elements.quizScoreTracker.style.display = state.mode === 'quiz' ? 'flex' : 'none';
            renderSingleCardView();
        }
    }

    // Render Single Flashcard / Quiz Question
    function renderSingleCardView() {
        const total = state.filteredQuestions.length;
        if (total === 0) {
            elements.cardQuestionBody.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--text-light);">
                    <p style="font-size: 1rem; margin-bottom: 6px; font-weight:700;">No questions match current filters.</p>
                    <p style="font-size: 0.8rem;">Try selecting "All Exams" or "All Years" in the filter bar above.</p>
                </div>
            `;
            elements.cardOptionsList.innerHTML = '';
            elements.revealAnswerWrap.style.display = 'none';
            elements.cardExplanationBox.style.display = 'none';
            elements.deckCounter.textContent = '0 / 0';
            elements.bottomCardIndex.textContent = '0';
            elements.bottomTotalCards.textContent = '0';
            elements.deckProgressBar.style.width = '0%';
            elements.prevBtn.disabled = true;
            elements.nextBtn.disabled = true;
            return;
        }

        const q = state.filteredQuestions[state.currentIndex];

        // Meta tags
        elements.cardExamBadge.textContent = q.deck || q.exam_type;
        elements.cardIdBadge.textContent = q.mcq_id ? `ID: ${q.mcq_id}` : `ID: ${q.id}`;
        elements.cardImageBadge.style.display = q.has_images ? 'inline-block' : 'none';
        elements.cardQNumberDisplay.textContent = `Q ${state.currentIndex + 1} / ${total}`;

        // Counter & Progress Bar
        elements.deckCounter.textContent = `${state.currentIndex + 1} / ${total}`;
        elements.bottomCardIndex.textContent = (state.currentIndex + 1).toString();
        elements.bottomTotalCards.textContent = total.toString();
        const progressPct = ((state.currentIndex + 1) / total) * 100;
        elements.deckProgressBar.style.width = `${progressPct}%`;

        // Star / Bookmark Button State
        if (state.bookmarks.has(q.id)) {
            elements.starCurrentBtn.classList.add('active');
            elements.starCurrentBtn.style.color = 'var(--warning)';
        } else {
            elements.starCurrentBtn.classList.remove('active');
            elements.starCurrentBtn.style.color = '';
        }

        // Question HTML
        elements.cardQuestionBody.innerHTML = q.question;

        // Render Options
        elements.cardOptionsList.innerHTML = '';
        const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const isAnsweredInQuiz = state.mode === 'quiz' && state.quizScore.answers[q.id];

        q.options.forEach((optText, optIdx) => {
            const optLetter = optionLetters[optIdx] || `(${optIdx + 1})`;
            const optDiv = document.createElement('div');
            optDiv.className = 'option-choice';
            optDiv.dataset.idx = optIdx;

            const isCorrect = (optIdx === q.correct_index);

            // Styling if already answered in Quiz or revealed in Flashcard
            if (state.mode === 'quiz' && isAnsweredInQuiz) {
                optDiv.classList.add('locked');
                const userAns = state.quizScore.answers[q.id];
                if (isCorrect) optDiv.classList.add('correct');
                if (userAns.selectedIndex === optIdx && !userAns.isCorrect) optDiv.classList.add('wrong');
            } else if (state.mode === 'flashcard' && state.isRevealed) {
                if (isCorrect) optDiv.classList.add('correct');
            }

            optDiv.innerHTML = `
                <div class="option-indicator">${optLetter}</div>
                <div class="option-text-body">${optText}</div>
            `;

            // Option Click Handler
            optDiv.addEventListener('click', () => {
                if (state.mode === 'quiz') {
                    handleQuizOptionSelect(q, optIdx);
                } else {
                    revealAnswer();
                }
            });

            elements.cardOptionsList.appendChild(optDiv);
        });

        // Explanation Box
        elements.correctAnswerText.textContent = q.correct_answer || (q.options[q.correct_index] || '');
        elements.cardExplanationContent.innerHTML = q.explanation;
        if (q.references && q.references.trim()) {
            elements.cardReferencesBox.style.display = 'block';
            elements.cardReferencesText.innerHTML = q.references;
        } else {
            elements.cardReferencesBox.style.display = 'none';
        }

        // Handle reveal state
        if (state.mode === 'quiz') {
            elements.revealAnswerWrap.style.display = 'none';
            elements.cardExplanationBox.style.display = isAnsweredInQuiz ? 'block' : 'none';
        } else {
            if (state.isRevealed) {
                elements.revealAnswerWrap.style.display = 'none';
                elements.cardExplanationBox.style.display = 'block';
            } else {
                elements.revealAnswerWrap.style.display = 'flex';
                elements.cardExplanationBox.style.display = 'none';
            }
        }

        // Navigation Buttons
        elements.prevBtn.disabled = (state.currentIndex === 0);
        elements.nextBtn.disabled = (state.currentIndex === total - 1);

        // Bind image zoom clicks in questions and explanations
        bindImageLightboxes();
    }

    // Quiz Option Click
    function handleQuizOptionSelect(q, selectedIdx) {
        if (state.quizScore.answers[q.id]) return;

        const isCorrect = (selectedIdx === q.correct_index);
        state.quizScore.attempted++;
        if (isCorrect) state.quizScore.correct++;
        state.quizScore.answers[q.id] = { selectedIndex: selectedIdx, isCorrect };

        updateQuizScoreDisplay();
        renderSingleCardView();
    }

    function updateQuizScoreDisplay() {
        const { correct, attempted } = state.quizScore;
        elements.quizScoreValue.textContent = `${correct} / ${attempted}`;
        const pct = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : '0';
        elements.quizPercentage.textContent = `(${pct}%)`;
    }

    function resetQuizScore() {
        state.quizScore = {
            correct: 0,
            attempted: 0,
            answers: {}
        };
        updateQuizScoreDisplay();
        renderSingleCardView();
    }

    // Flashcard Reveal
    function revealAnswer() {
        state.isRevealed = true;
        renderSingleCardView();
    }

    // Prev / Next Question Navigation
    function prevQuestion() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            state.isRevealed = false;
            renderSingleCardView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function nextQuestion() {
        if (state.currentIndex < state.filteredQuestions.length - 1) {
            state.currentIndex++;
            state.isRevealed = false;
            renderSingleCardView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Shuffle
    function shuffleQuestions() {
        for (let i = state.filteredQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.filteredQuestions[i], state.filteredQuestions[j]] = [state.filteredQuestions[j], state.filteredQuestions[i]];
        }
        state.currentIndex = 0;
        state.isRevealed = false;
        renderSingleCardView();
    }

    // Star / Bookmark Toggle
    function toggleBookmarkCurrent() {
        if (state.filteredQuestions.length === 0) return;
        const q = state.filteredQuestions[state.currentIndex];
        if (state.bookmarks.has(q.id)) {
            state.bookmarks.delete(q.id);
        } else {
            state.bookmarks.add(q.id);
        }
        localStorage.setItem('marrow_pyq_bookmarks', JSON.stringify([...state.bookmarks]));
        updateBookmarkCountBadge();
        renderSingleCardView();
    }

    function updateBookmarkCountBadge() {
        const count = state.bookmarks.size.toString();
        elements.bookmarkCount.textContent = count;
        if (elements.bNavBookmarkBadge) {
            elements.bNavBookmarkBadge.textContent = count;
        }
    }

    async function toggleBookmarksFilter() {
        // If on home, load default subject first
        if (elements.homeSection.style.display !== 'none' || !state.currentSubjectSlug) {
            const defaultSlug = (state.subjectsMeta && state.subjectsMeta.subjects.length > 0) 
                ? state.subjectsMeta.subjects[0].slug 
                : 'anaesthesia';
            await loadSubject(defaultSlug);
        }

        state.showOnlyBookmarked = !state.showOnlyBookmarked;
        if (state.showOnlyBookmarked) {
            elements.bookmarkedBtn.style.background = 'var(--warning-light)';
            elements.bookmarkedBtn.style.borderColor = 'var(--warning)';
        } else {
            elements.bookmarkedBtn.style.background = '';
            elements.bookmarkedBtn.style.borderColor = '';
        }
        applyFilters();
        renderCurrentView();
        updateNavState(state.showOnlyBookmarked ? 'bookmarks' : state.mode);
    }

    // Render List View
    function renderListView() {
        elements.listCount.textContent = state.filteredQuestions.length.toString();
        elements.listItemsContainer.innerHTML = '';

        if (state.filteredQuestions.length === 0) {
            elements.listItemsContainer.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-light);">No questions match current filters.</div>';
            return;
        }

        const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        state.filteredQuestions.forEach((q, idx) => {
            const item = document.createElement('div');
            item.className = 'list-card-item';

            let optsHtml = '';
            q.options.forEach((opt, optIdx) => {
                const letter = optionLetters[optIdx] || `(${optIdx + 1})`;
                const isCorrect = (optIdx === q.correct_index);
                optsHtml += `
                    <div class="list-opt-item ${isCorrect ? 'correct' : ''}">
                        <strong>${letter}.</strong> ${opt}
                    </div>
                `;
            });

            item.innerHTML = `
                <div class="list-card-header">
                    <div>
                        <strong style="color: var(--primary);">Q${idx + 1}.</strong>
                        <span class="card-badge exam-badge">${q.deck || q.exam_type}</span>
                        ${q.mcq_id ? `<span class="card-badge id-badge">ID: ${q.mcq_id}</span>` : ''}
                    </div>
                    <div>
                        <button class="icon-action-btn ${state.bookmarks.has(q.id) ? 'active' : ''}" data-qid="${q.id}" title="Star / Bookmark">⭐</button>
                    </div>
                </div>
                <div class="list-q-text">${q.question}</div>
                <div class="list-options">${optsHtml}</div>
                <button class="btn-toggle-exp" data-id="${q.id}">
                    <span>&#9662; Show Explanation</span>
                </button>
                <div class="list-exp-content" id="exp_${q.id}" style="display:none; margin-top: 8px; padding: 10px; background: var(--bg-secondary); border-radius: var(--radius-sm);">
                    <div style="font-weight:700; color:var(--success-text); margin-bottom: 6px;">Correct: ${q.correct_answer}</div>
                    <div style="font-size: 0.9rem;">${q.explanation}</div>
                    ${q.references ? `<div style="margin-top: 6px; font-size: 0.78rem; color: var(--text-light);">${q.references}</div>` : ''}
                </div>
            `;

            // Toggle explanation click
            const toggleBtn = item.querySelector('.btn-toggle-exp');
            const expDiv = item.querySelector(`#exp_${q.id}`);
            toggleBtn.addEventListener('click', () => {
                const isHidden = expDiv.style.display === 'none';
                expDiv.style.display = isHidden ? 'block' : 'none';
                toggleBtn.querySelector('span').innerHTML = isHidden ? '&#9652; Hide Explanation' : '&#9662; Show Explanation';
            });

            // Bookmark button click
            const starBtn = item.querySelector('button[data-qid]');
            starBtn.addEventListener('click', () => {
                if (state.bookmarks.has(q.id)) {
                    state.bookmarks.delete(q.id);
                    starBtn.classList.remove('active');
                } else {
                    state.bookmarks.add(q.id);
                    starBtn.classList.add('active');
                }
                localStorage.setItem('marrow_pyq_bookmarks', JSON.stringify([...state.bookmarks]));
                updateBookmarkCountBadge();
            });

            elements.listItemsContainer.appendChild(item);
        });

        bindImageLightboxes();
    }

    function toggleAllListExplanations(show) {
        document.querySelectorAll('.list-exp-content').forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
        document.querySelectorAll('.btn-toggle-exp span').forEach(el => {
            el.innerHTML = show ? '&#9652; Hide Explanation' : '&#9662; Show Explanation';
        });
    }

    // Image Lightbox
    function bindImageLightboxes() {
        document.querySelectorAll('.card-question-body img, .explanation-content img, .list-q-text img, .list-exp-content img').forEach(img => {
            img.addEventListener('click', () => {
                elements.lightboxImg.src = img.src;
                elements.lightboxCaption.textContent = img.alt || 'Clinical Diagram / Slide Image';
                elements.imageLightbox.style.display = 'flex';
            });
        });
    }

    // Global Search
    async function loadSearchIndex() {
        if (state.searchIndex) return state.searchIndex;
        try {
            const resp = await fetch('data/search_index.json');
            state.searchIndex = await resp.json();
            return state.searchIndex;
        } catch (e) {
            console.error('Failed to load search index:', e);
            return [];
        }
    }

    async function performSearch(query) {
        query = query.trim().toLowerCase();
        if (!query) {
            elements.searchResultsSection.style.display = 'none';
            return;
        }

        const index = await loadSearchIndex();
        const results = index.filter(item => {
            return (item.mid && item.mid.toLowerCase().includes(query)) ||
                   (item.q && item.q.toLowerCase().includes(query)) ||
                   (item.sub && item.sub.toLowerCase().includes(query)) ||
                   (item.ex && item.ex.toLowerCase().includes(query));
        }).slice(0, 40);

        elements.searchResultCount.textContent = results.length.toString();
        elements.searchResultsList.innerHTML = '';

        if (results.length === 0) {
            elements.searchResultsList.innerHTML = '<div style="padding: 14px; color: var(--text-light); text-align:center;">No matching questions found.</div>';
        } else {
            results.forEach(res => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="search-item-meta">
                        <span class="card-badge exam-badge">${res.ex || ''} ${res.yr || ''}</span>
                        <span class="card-badge id-badge">${res.mid || res.id}</span>
                        <span class="subject-badge">${res.sub}</span>
                    </div>
                    <div class="search-item-text">${res.q}</div>
                `;
                item.addEventListener('click', async () => {
                    elements.searchResultsSection.style.display = 'none';
                    elements.globalSearchInput.value = '';
                    elements.clearSearchBtn.style.display = 'none';
                    if (elements.searchContainer) elements.searchContainer.classList.remove('mobile-active');
                    await loadSubject(res.sub, res.id);
                });
                elements.searchResultsList.appendChild(item);
            });
        }

        elements.searchResultsSection.style.display = 'block';
    }

    // Event Bindings
    function bindEvents() {
        // Logo / Brand Click -> Home
        if (elements.logoHomeBtn) {
            elements.logoHomeBtn.addEventListener('click', showHomeView);
        }

        // Theme toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Mobile Search Toggle
        if (elements.mobileSearchToggleBtn && elements.searchContainer) {
            elements.mobileSearchToggleBtn.addEventListener('click', () => {
                const isActive = elements.searchContainer.classList.toggle('mobile-active');
                if (isActive) {
                    elements.globalSearchInput.focus();
                }
            });
        }

        // Mobile Bottom Navigation Bar Items
        elements.bNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const bnav = item.dataset.bnav;
                if (bnav === 'home') {
                    showHomeView();
                } else if (bnav === 'flashcard' || bnav === 'quiz' || bnav === 'list') {
                    setMode(bnav);
                } else if (bnav === 'bookmarks') {
                    toggleBookmarksFilter();
                }
            });
        });

        // Subject select
        elements.subjectSelect.addEventListener('change', (e) => {
            loadSubject(e.target.value);
        });

        // Exam filter pills
        elements.filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                elements.filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.examFilter = pill.dataset.exam;
                applyFilters();
                renderCurrentView();
            });
        });

        // Year select
        elements.yearSelect.addEventListener('change', (e) => {
            state.yearFilter = e.target.value;
            applyFilters();
            renderCurrentView();
        });

        // Desktop Mode tabs
        elements.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                setMode(tab.dataset.mode);
            });
        });

        // Reveal answer button
        elements.revealAnswerBtn.addEventListener('click', revealAnswer);

        // Prev / Next buttons
        elements.prevBtn.addEventListener('click', prevQuestion);
        elements.nextBtn.addEventListener('click', nextQuestion);

        // Star current
        elements.starCurrentBtn.addEventListener('click', toggleBookmarkCurrent);

        // Shuffle
        elements.shuffleBtn.addEventListener('click', shuffleQuestions);

        // Desktop Bookmarks header button
        elements.bookmarkedBtn.addEventListener('click', toggleBookmarksFilter);

        // Reset quiz score
        elements.resetQuizBtn.addEventListener('click', resetQuizScore);

        // List view controls
        elements.expandAllExplanationsBtn.addEventListener('click', () => toggleAllListExplanations(true));
        elements.collapseAllExplanationsBtn.addEventListener('click', () => toggleAllListExplanations(false));

        // Lightbox close
        elements.closeLightboxBtn.addEventListener('click', () => {
            elements.imageLightbox.style.display = 'none';
        });
        elements.imageLightbox.addEventListener('click', (e) => {
            if (e.target === elements.imageLightbox || e.target.classList.contains('lightbox-backdrop')) {
                elements.imageLightbox.style.display = 'none';
            }
        });

        // PDF Downloads Modal
        elements.pdfDownloadsModalBtn.addEventListener('click', () => {
            elements.pdfModal.style.display = 'flex';
        });
        elements.closePdfModalBtn.addEventListener('click', () => {
            elements.pdfModal.style.display = 'none';
        });
        elements.pdfModal.addEventListener('click', (e) => {
            if (e.target === elements.pdfModal) elements.pdfModal.style.display = 'none';
        });

        // Shortcuts Modal
        if (elements.shortcutsBtn) {
            elements.shortcutsBtn.addEventListener('click', () => {
                elements.shortcutsModal.style.display = 'flex';
            });
        }
        elements.closeShortcutsModalBtn.addEventListener('click', () => {
            elements.shortcutsModal.style.display = 'none';
        });
        elements.shortcutsModal.addEventListener('click', (e) => {
            if (e.target === elements.shortcutsModal) elements.shortcutsModal.style.display = 'none';
        });

        // Search inputs
        let debounceTimer;
        elements.globalSearchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const val = e.target.value;
            elements.clearSearchBtn.style.display = val ? 'block' : 'none';
            debounceTimer = setTimeout(() => performSearch(val), 200);
        });
        elements.clearSearchBtn.addEventListener('click', () => {
            elements.globalSearchInput.value = '';
            elements.clearSearchBtn.style.display = 'none';
            elements.searchResultsSection.style.display = 'none';
        });
        elements.closeSearchBtn.addEventListener('click', () => {
            elements.searchResultsSection.style.display = 'none';
            if (elements.searchContainer) elements.searchContainer.classList.remove('mobile-active');
        });

        // Print PDF button
        elements.printBtn.addEventListener('click', () => {
            if (state.mode === 'flashcard') {
                const wantList = confirm('Would you like to print all questions in this subject as a complete Question Booklet? (Click OK to print all, or Cancel to print just the current card)');
                if (wantList) {
                    setMode('list');
                    toggleAllListExplanations(true);
                    setTimeout(() => window.print(), 300);
                    return;
                }
            }
            window.print();
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                if (e.key === 'Escape') {
                    elements.globalSearchInput.blur();
                    elements.searchResultsSection.style.display = 'none';
                    if (elements.searchContainer) elements.searchContainer.classList.remove('mobile-active');
                }
                return;
            }

            if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                nextQuestion();
            } else if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                prevQuestion();
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                revealAnswer();
            } else if (['1', '2', '3', '4'].includes(e.key) && state.mode === 'quiz') {
                const optIdx = parseInt(e.key, 10) - 1;
                const q = state.filteredQuestions[state.currentIndex];
                if (q && q.options[optIdx]) {
                    handleQuizOptionSelect(q, optIdx);
                }
            } else if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                toggleBookmarkCurrent();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                shuffleQuestions();
            } else if (e.key === '/') {
                e.preventDefault();
                elements.globalSearchInput.focus();
            } else if (e.key === 'Escape') {
                elements.imageLightbox.style.display = 'none';
                elements.pdfModal.style.display = 'none';
                elements.shortcutsModal.style.display = 'none';
                elements.searchResultsSection.style.display = 'none';
                if (elements.searchContainer) elements.searchContainer.classList.remove('mobile-active');
            }
        });
    }

    // Start App on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
