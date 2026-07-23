/* ==========================================================================
   STUDIO ROOM - CORE LOGIC & RECORDER ENGINE
   ========================================================================== */

class Metronome {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.bpm = 80;
    this.nextNoteTime = 0;
    this.current16thNote = 0;
    this.timeoutId = null;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.current16thNote++;
    if (this.current16thNote === 4) {
      this.current16thNote = 0;
    }
  }

  playClick(time) {
    const osc = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();

    osc.frequency.value = (this.current16thNote === 0) ? 1000 : 800;
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(1, time + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(envelope);
    envelope.connect(this.audioContext.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  scheduler() {
    while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
      this.playClick(this.nextNoteTime);
      this.nextNote();
    }
    if (this.isPlaying) {
      this.timeoutId = setTimeout(() => this.scheduler(), 25);
    }
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.isPlaying = true;
    this.current16thNote = 0;
    this.nextNoteTime = this.audioContext.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timeoutId);
  }
  
  setBpm(bpm) {
    this.bpm = bpm;
  }
}

class StudioApp {
  constructor() {
    // 1. Initial State Definition
    this.routine = null;
    this.currentDayIndex = 0; // 0-indexed index in routine.days
    this.currentExerciseIndex = 0; // 0-indexed index of today's exercises
    
    // Recording & Timer States
    this.recState = 'idle'; // 'idle', 'active', 'paused'
    this.exerciseElapsed = 0; // in seconds
    this.sessionElapsed = 0; // in seconds
    this.timerIntervalId = null;
    this.totalPracticeSeconds = 0; // total accumulated practice time in seconds
    
    // Media Streams & Recorder
    this.webcamStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.finalVideoBlob = null;
    this.finalVideoUrl = null;

    // Metronome
    this.metronome = new Metronome();
    
    // Canvas dimensions & Animation loop
    this.canvasWidth = 1280;
    this.canvasHeight = 720;
    this.animationFrameId = null;
    this.lastOverlayDrawTime = 0;

    // DOM Elements Cache
    this.initDOMElements();

    // Bind Event Listeners
    this.bindEvents();

    // Start App Setup
    this.initApp();
  }

  // ------------------------------------------------------------------------
  // DOM CACHING & SETUP
  // ------------------------------------------------------------------------
  initDOMElements() {
    // Views
    this.views = {
      dashboard: document.getElementById('viewDashboard'),
      studio: document.getElementById('viewStudio'),
      summary: document.getElementById('viewSummary')
    };

    // Header Info
    this.streakText = document.querySelector('#streakBadge .streak-text');
    this.totalTimeText = document.getElementById('totalTimeText');
    this.btnConfig = document.getElementById('btnConfig');

    // Dashboard View Elements
    this.currentDayTitle = document.getElementById('currentDayTitle');
    this.currentDayDuration = document.getElementById('currentDayDuration');
    this.exercisesSummaryList = document.getElementById('exercisesSummaryList');
    this.btnEnterStudio = document.getElementById('btnEnterStudio');
    this.daysList = document.getElementById('daysList');

    // Studio View Elements
    this.studioCanvas = document.getElementById('studioCanvas');
    this.hiddenVideo = document.getElementById('hiddenVideo');
    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.btnNextExercise = document.getElementById('btnNextExercise');
    this.btnEndSession = document.getElementById('btnEndSession');
    
    this.cameraSelect = document.getElementById('cameraSelect');
    this.micSelect = document.getElementById('micSelect');
    this.mirrorToggle = document.getElementById('mirrorToggle');
    
    this.btnMetronomeToggle = document.getElementById('btnMetronomeToggle');
    this.metronomeBpm = document.getElementById('metronomeBpm');

    this.progressText = document.getElementById('progressText');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.exercisesInteractiveList = document.getElementById('exercisesInteractiveList');
    this.activeExerciseNotes = document.getElementById('activeExerciseNotes');

    // Summary View Elements
    this.finalVideoPlayer = document.getElementById('finalVideoPlayer');
    this.summaryDate = document.getElementById('summaryDate');
    this.summaryTime = document.getElementById('summaryTime');
    this.summaryExercises = document.getElementById('summaryExercises');
    this.btnDownloadVideo = document.getElementById('btnDownloadVideo');
    this.btnBackToDashboard = document.getElementById('btnBackToDashboard');

    // Configuration Modal
    this.modalConfig = document.getElementById('modalConfig');
    this.btnCloseConfig = document.getElementById('btnCloseConfig');
    this.jsonRoutineInput = document.getElementById('jsonRoutineInput');
    this.btnResetConfig = document.getElementById('btnResetConfig');
    this.btnSaveConfig = document.getElementById('btnSaveConfig');
    this.jsonErrorMsg = document.getElementById('jsonErrorMsg');

    // Setup canvas resolution
    this.studioCanvas.width = this.canvasWidth;
    this.studioCanvas.height = this.canvasHeight;
    this.ctx = this.studioCanvas.getContext('2d');
  }

  bindEvents() {
    // Navigation & Studio Entrance
    this.btnEnterStudio.addEventListener('click', () => this.enterStudio());
    this.btnBackToDashboard.addEventListener('click', () => this.backToDashboard());

    // Practice controls
    this.btnPlayPause.addEventListener('click', () => this.togglePractice());
    this.btnNextExercise.addEventListener('click', () => this.nextExercise());
    this.btnEndSession.addEventListener('click', () => this.endSession());

    // Settings Modal
    this.btnConfig.addEventListener('click', () => this.openConfigModal());
    this.btnCloseConfig.addEventListener('click', () => this.closeConfigModal());
    this.btnResetConfig.addEventListener('click', () => this.resetToDefaultRoutine());
    this.btnSaveConfig.addEventListener('click', () => this.saveConfigRoutine());
    
    // Auto-close dialog clicking outside
    this.modalConfig.addEventListener('click', (e) => {
      if (e.target === this.modalConfig) this.closeConfigModal();
    });

    // Device changes
    this.cameraSelect.addEventListener('change', () => this.setupDevices());
    this.micSelect.addEventListener('change', () => this.setupDevices());

    // Metronome
    this.btnMetronomeToggle.addEventListener('click', () => this.toggleMetronome());
    this.metronomeBpm.addEventListener('input', (e) => this.metronome.setBpm(parseInt(e.target.value, 10) || 80));

    // Download action
    this.btnDownloadVideo.addEventListener('click', () => this.downloadVideo());

    // Window Visibility API (Auto-pause practice when tab is unfocused)
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    // Keyboard shortcuts (only active in Studio view)
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  handleKeyboardShortcuts(e) {
    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Only process shortcuts when in Studio view
    if (!this.views.studio.classList.contains('active')) return;

    // Space: Toggle practice (start/pause/resume)
    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePractice();
    }
    
    // M: Toggle metronome
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.toggleMetronome();
    }
    
    // Arrow Up: Increase BPM by 5
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      const currentBpm = parseInt(this.metronomeBpm.value, 10) || 80;
      const newBpm = Math.min(240, currentBpm + 5);
      this.metronomeBpm.value = newBpm;
      this.metronome.setBpm(newBpm);
    }
    
    // Arrow Down: Decrease BPM by 5
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      const currentBpm = parseInt(this.metronomeBpm.value, 10) || 80;
      const newBpm = Math.max(40, currentBpm - 5);
      this.metronomeBpm.value = newBpm;
      this.metronome.setBpm(newBpm);
    }
  }

  // ------------------------------------------------------------------------
  // APP INTIALIZATION & LOCALSTORAGE
  // ------------------------------------------------------------------------
  async initApp() {
    // Load streak
    const savedStreak = localStorage.getItem('studio_room_streak');
    this.streak = savedStreak ? parseInt(savedStreak, 10) : 0;
    this.updateStreakDisplay();

    // Load total practice time
    const savedTotalTime = localStorage.getItem('studio_room_total_time');
    this.totalPracticeSeconds = savedTotalTime ? parseInt(savedTotalTime, 10) : 0;
    this.updateTotalTimeDisplay();

    // Load selected day index
    const savedDayIndex = localStorage.getItem('studio_room_current_day_index');
    this.currentDayIndex = savedDayIndex ? parseInt(savedDayIndex, 10) : 0;

    // Load routine JSON - prioritize localStorage (user edits from visual editor)
    await this.loadRoutineFromFile();
  }

  async loadRoutineFromFile() {
    // Priority: 1) localStorage (user edits from visual editor), 2) routine.json (default file), 3) fallback
    
    // First, check if user has saved data in localStorage
    const savedRoutine = localStorage.getItem('studio_room_routine');
    if (savedRoutine) {
      try {
        this.routine = JSON.parse(savedRoutine);
        this.renderDashboard();
        return;
      } catch (err) {
        console.warn('Error parsing saved routine from localStorage, falling back to file:', err);
      }
    }
    
    // Second, try to load from routine.json file
    try {
      const response = await fetch('routine.json');
      if (response.ok) {
        this.routine = await response.json();
        // Cache in localStorage for future sessions
        localStorage.setItem('studio_room_routine', JSON.stringify(this.routine));
        this.renderDashboard();
      } else {
        throw new Error("Unable to fetch routine.json");
      }
    } catch (err) {
      console.warn("Could not load routine.json, using fallback routine configuration", err);
      this.routine = this.getFallbackRoutine();
      localStorage.setItem('studio_room_routine', JSON.stringify(this.routine));
      this.renderDashboard();
    }
  }

  getFallbackRoutine() {
    return {
      "routineName": "Estudio de Guitarra - Rutina Básica",
      "days": [
        {
          "dayNumber": 1,
          "title": "Calentamiento y Tríadas",
          "durationMinutes": 25,
          "exercises": [
            {
              "id": "f1",
              "name": "Ejercicios Cromáticos Lentos",
              "duration": 300,
              "notes": "Tocar a 60 BPM enfocándose en la relajación muscular de manos."
            },
            {
              "id": "f2",
              "name": "Tríadas Mayores Cuerdas Altas",
              "duration": 600,
              "notes": "Tríadas de C, F, G en las primeras 3 cuerdas."
            },
            {
              "id": "f3",
              "name": "Improvisación Libre",
              "duration": 600,
              "notes": "Tocar libremente sobre una pista de acompañamiento."
            }
          ]
        }
      ]
    };
  }

  updateStreakDisplay() {
    this.streakText.textContent = `${this.streak} ${this.streak === 1 ? 'Día seguido' : 'Días seguidos'}`;
  }

  updateTotalTimeDisplay() {
    const totalSeconds = this.totalPracticeSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    this.totalTimeText.textContent = `${hours}h ${minutes}m`;
  }

  saveTotalTime() {
    localStorage.setItem('studio_room_total_time', this.totalPracticeSeconds.toString());
  }

  // ------------------------------------------------------------------------
  // VIEW TRANSITIONS
  // ------------------------------------------------------------------------
  switchView(viewName) {
    Object.keys(this.views).forEach(key => {
      this.views[key].classList.remove('active');
    });
    
    // Small timeout to allow transition effects
    setTimeout(() => {
      this.views[viewName].classList.add('active');
    }, 50);
  }

  // ------------------------------------------------------------------------
  // VISTA 1: DASHBOARD
  // ------------------------------------------------------------------------
  renderDashboard() {
    if (!this.routine || !this.routine.days) return;

    // Safety bounds check
    if (this.currentDayIndex >= this.routine.days.length) {
      this.currentDayIndex = 0;
    }

    const currentDay = this.routine.days[this.currentDayIndex];
    this.currentDayTitle.textContent = `Día ${currentDay.dayNumber}: ${currentDay.title}`;
    this.currentDayDuration.textContent = currentDay.durationMinutes;

    // Render exercises summary
    this.exercisesSummaryList.innerHTML = '';
    currentDay.exercises.forEach(ex => {
      const li = document.createElement('li');
      
      // Inline styles to accommodate the subtitle without breaking global CSS
      li.style.display = 'flex';
      li.style.flexDirection = 'column';
      li.style.alignItems = 'flex-start';
      li.style.gap = '0.3rem';
      
      const timeStr = this.formatTimeMinutes(ex.duration);
      
      // Extract a short preview from the notes (up to first period or 80 chars)
      let notesPreview = ex.notes.split('.')[0];
      if (notesPreview.length > 80) notesPreview = notesPreview.substring(0, 80) + '...';
      
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <strong>${ex.name}</strong> 
          <span class="day-duration" style="white-space: nowrap;">${timeStr}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--slate-400); line-height: 1.4; padding-left: 0.2rem;">
          ${notesPreview}
        </div>
      `;
      this.exercisesSummaryList.appendChild(li);
    });

    // Render calendar sidebar list
    this.daysList.innerHTML = '';
    const completedDays = JSON.parse(localStorage.getItem('studio_room_completed_days') || '[]');

    this.routine.days.forEach((day, index) => {
      const isCompleted = completedDays.includes(day.dayNumber);
      const isActive = index === this.currentDayIndex;

      const dayItem = document.createElement('div');
      dayItem.className = `day-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
      
      dayItem.innerHTML = `
        <div class="day-info">
          <span class="day-number">DÍA ${day.dayNumber}</span>
          <span class="day-title">${day.title}</span>
        </div>
        <span class="day-duration">${day.durationMinutes}m</span>
      `;

      dayItem.addEventListener('click', () => {
        if (this.recState !== 'idle') {
          if (!confirm("Tienes una sesión activa en el estudio. ¿Deseas salir y cambiar de día?")) {
            return;
          }
          this.cleanupStudioStreams();
        }
        this.currentDayIndex = index;
        localStorage.setItem('studio_room_current_day_index', index);
        this.renderDashboard();
      });

      this.daysList.appendChild(dayItem);
    });
  }

  formatTimeMinutes(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  // ------------------------------------------------------------------------
  // VISTA 2: ESTUDIO EN VIVO
  // ------------------------------------------------------------------------
  async enterStudio() {
    this.currentExerciseIndex = 0;
    this.exerciseElapsed = 0;
    this.sessionElapsed = 0;
    this.recState = 'idle';
    this.recordedChunks = [];

    // Switch view
    this.switchView('studio');
    
    // Set interface values
    this.updateStudioUI();

    // Ask for media permissions and populate device lists
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop track immediately, we just wanted user approval to list devices
      initialStream.getTracks().forEach(track => track.stop());
      
      await this.populateDevices();
      await this.setupDevices();
    } catch (err) {
      console.error("No se pudo obtener acceso a cámara/micrófono:", err);
      alert("Para usar el Estudio de Grabación, debes permitir el acceso a tu cámara y micrófono.");
      this.backToDashboard();
    }
  }

  async populateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Save current values to keep selected if reload
      const prevCam = this.cameraSelect.value;
      const prevMic = this.micSelect.value;

      this.cameraSelect.innerHTML = '';
      this.micSelect.innerHTML = '';

      let camsCount = 0;
      let micsCount = 0;

      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        
        if (device.kind === 'videoinput') {
          option.textContent = device.label || `Cámara ${++camsCount}`;
          this.cameraSelect.appendChild(option);
        } else if (device.kind === 'audioinput') {
          option.textContent = device.label || `Micrófono ${++micsCount}`;
          this.micSelect.appendChild(option);
        }
      });

      // Restore values if still available
      if (Array.from(this.cameraSelect.options).some(o => o.value === prevCam)) {
        this.cameraSelect.value = prevCam;
      }
      if (Array.from(this.micSelect.options).some(o => o.value === prevMic)) {
        this.micSelect.value = prevMic;
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }

  async setupDevices() {
    // Stop current stream if running
    this.cleanupStudioStreams();

    const videoId = this.cameraSelect.value;
    const micId = this.micSelect.value;

    const constraints = {
      video: videoId ? { deviceId: { exact: videoId }, width: 1280, height: 720 } : { width: 1280, height: 720 },
      audio: micId ? { deviceId: { exact: micId } } : true
    };

    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.hiddenVideo.srcObject = this.webcamStream;
      this.hiddenVideo.play();

      // Start the canvas rendering loop
      if (!this.animationFrameId) {
        this.animationFrameId = requestAnimationFrame((t) => this.drawCanvasLoop(t));
      }
    } catch (err) {
      console.error("Error setting up selected devices:", err);
      // Fallback: try standard settings if specific constraint fails
      if (videoId || micId) {
        this.cameraSelect.value = "";
        this.micSelect.value = "";
        await this.setupDevices();
      }
    }
  }

  cleanupStudioStreams() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
    this.hiddenVideo.srcObject = null;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updateStudioUI() {
    const currentDay = this.routine.days[this.currentDayIndex];
    const totalExercises = currentDay.exercises.length;
    const currentEx = currentDay.exercises[this.currentExerciseIndex];

    // Progress bar
    const progressPercent = (this.currentExerciseIndex / totalExercises) * 100;
    this.progressBarFill.style.width = `${progressPercent}%`;
    this.progressText.textContent = `${this.currentExerciseIndex}/${totalExercises} completados`;

    // Notes
    this.activeExerciseNotes.innerHTML = `
      <p><strong>${currentEx.name}</strong></p>
      <p style="margin-top: 0.5rem; color: var(--slate-300);">${currentEx.notes || 'Sin notas especiales para este ejercicio.'}</p>
    `;

    // Exercises Interactive List
    this.exercisesInteractiveList.innerHTML = '';
    currentDay.exercises.forEach((ex, idx) => {
      const isCompleted = idx < this.currentExerciseIndex;
      const isActive = idx === this.currentExerciseIndex;
      const isPending = idx > this.currentExerciseIndex;

      let statusClass = 'pending';
      let icon = '⏳';
      if (isCompleted) {
        statusClass = 'completed';
        icon = '✅';
      } else if (isActive) {
        statusClass = 'active';
        icon = '▶️';
      }

      const li = document.createElement('li');
      li.className = `ex-item-interactive ${statusClass}`;
      li.innerHTML = `
        <div style="display:flex; align-items:center; gap: 0.5rem;">
          <span>${icon}</span>
          <span class="ex-name-label">${idx + 1}. ${ex.name}</span>
        </div>
        <span class="ex-meta-badge">${this.formatTime(ex.duration)}</span>
      `;
      this.exercisesInteractiveList.appendChild(li);
    });

    // Control buttons state
    this.updateControlsButtonState();
  }

  updateControlsButtonState() {
    if (this.recState === 'idle') {
      this.btnPlayPause.className = 'btn btn-success';
      this.btnPlayPause.innerHTML = `<span class="btn-icon-symbol">▶️</span> <span class="btn-label-text">Iniciar Ejercicio</span>`;
      this.btnNextExercise.disabled = true;
    } else if (this.recState === 'active') {
      this.btnPlayPause.className = 'btn btn-secondary'; // obs grey style
      this.btnPlayPause.innerHTML = `<span class="btn-icon-symbol">⏸️</span> <span class="btn-label-text">Pausar Ejercicio</span>`;
      this.btnNextExercise.disabled = false;
    } else if (this.recState === 'paused') {
      this.btnPlayPause.className = 'btn btn-success';
      this.btnPlayPause.innerHTML = `<span class="btn-icon-symbol">▶️</span> <span class="btn-label-text">Reanudar Ejercicio</span>`;
      this.btnNextExercise.disabled = false;
    }
  }

  // ------------------------------------------------------------------------
  // RECORDING & TIMERS MOTOR
  // ------------------------------------------------------------------------
  togglePractice() {
    if (this.recState === 'idle') {
      this.startRecordingAndPractice();
    } else if (this.recState === 'active') {
      this.pausePractice();
    } else if (this.recState === 'paused') {
      this.resumePractice();
    }
  }

  toggleMetronome() {
    if (this.metronome.isPlaying) {
      this.metronome.stop();
      this.btnMetronomeToggle.innerHTML = '<span>⏱️ Iniciar Metrónomo</span>';
      this.btnMetronomeToggle.className = 'btn btn-secondary';
    } else {
      this.metronome.start();
      this.btnMetronomeToggle.innerHTML = '<span>⏹️ Detener Metrónomo</span>';
      this.btnMetronomeToggle.className = 'btn btn-danger';
    }
  }

  startRecordingAndPractice() {
    this.recState = 'active';
    this.updateControlsButtonState();

    // Start high quality canvas MediaRecorder
    this.recordedChunks = [];
    this.recordedSegments = [];
    this.currentSegmentStart = 0;
    const videoTrack = this.studioCanvas.captureStream(30).getVideoTracks()[0];
    const combinedStream = new MediaStream();
    
    // Add canvas video track
    combinedStream.addTrack(videoTrack);
    
    // Add microphone track if user allowed and track exists
    if (this.webcamStream) {
      const audioTracks = this.webcamStream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedStream.addTrack(audioTracks[0]);
      }
    }

    // MIME Types detection (order of preference)
    const options = [
      { mimeType: 'video/webm;codecs=vp9' },
      { mimeType: 'video/webm;codecs=vp8' },
      { mimeType: 'video/webm' },
      { mimeType: 'video/mp4;codecs=h264' },
      { mimeType: 'video/mp4' }
    ];

    let selectedOption = null;
    for (const opt of options) {
      if (MediaRecorder.isTypeSupported(opt.mimeType)) {
        selectedOption = opt;
        break;
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, selectedOption || {});
    } catch (e) {
      console.warn("Selected codec config failed. Initializing standard MediaRecorder default format", e);
      this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // Trigger dataavailable chunks each second (safeguard)
    this.startTimers();
  }

  pausePractice() {
    if (this.recState !== 'active') return;
    this.recState = 'paused';
    this.updateControlsButtonState();

    // Pause MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }

    // Stop timers ticks
    this.stopTimers();
  }

  resumePractice() {
    if (this.recState !== 'paused') return;
    this.recState = 'active';
    this.updateControlsButtonState();

    // Resume MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }

    // Restart timers ticks
    this.startTimers();
  }

  nextExercise() {
    const currentDay = this.routine.days[this.currentDayIndex];
    
    // Save segment before incrementing
    const ex = currentDay.exercises[this.currentExerciseIndex];
    if (this.recordedSegments !== undefined) {
      this.recordedSegments.push({
        id: `e${this.currentExerciseIndex + 1}`,
        exercise: ex.name,
        startTime: this.currentSegmentStart,
        endTime: this.sessionElapsed
      });
      this.currentSegmentStart = this.sessionElapsed;
    }

    // Save state
    this.currentExerciseIndex++;

    if (this.currentExerciseIndex < currentDay.exercises.length) {
      // Move to next exercise
      this.exerciseElapsed = 0;
      this.updateStudioUI();
      // If we are currently paused, keep it paused. If active, continue active.
    } else {
      // Finished all exercises
      this.endSession();
    }
  }

  async endSession() {
    this.stopTimers();
    if (this.metronome.isPlaying) {
      this.toggleMetronome();
    }

    // Save final status
    const currentDay = this.routine.days[this.currentDayIndex];

    if (this.recState !== 'idle') {
      this.recState = 'idle';
      
      // Stop media recording
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        // We set up a Promise so we can wait for all data to compile
        await new Promise((resolve) => {
          this.mediaRecorder.onstop = () => resolve();
          this.mediaRecorder.stop();
        });
      }
    }

    // Save completed day to LocalStorage
    const completedDays = JSON.parse(localStorage.getItem('studio_room_completed_days') || '[]');
    if (!completedDays.includes(currentDay.dayNumber)) {
      completedDays.push(currentDay.dayNumber);
      localStorage.setItem('studio_room_completed_days', JSON.stringify(completedDays));
    }

    // Update streak logic
    this.updatePracticeStreak();

    // Update total practice time
    this.totalPracticeSeconds += this.sessionElapsed;
    this.saveTotalTime();
    this.updateTotalTimeDisplay();

    // Move to summary
    this.showSummaryView();
  }

  updatePracticeStreak() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastPracticeStr = localStorage.getItem('studio_room_last_practice');

    if (lastPracticeStr !== todayStr) {
      if (lastPracticeStr) {
        const lastPracticeDate = new Date(lastPracticeStr);
        const todayDate = new Date(todayStr);
        
        // Calculate difference in days
        const diffTime = Math.abs(todayDate - lastPracticeDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Practice on consecutive days
          this.streak += 1;
        } else if (diffDays > 1) {
          // Streak broken
          this.streak = 1;
        }
      } else {
        // First practice ever
        this.streak = 1;
      }

      localStorage.setItem('studio_room_streak', this.streak);
      localStorage.setItem('studio_room_last_practice', todayStr);
      this.updateStreakDisplay();
    }
  }

  // Precision 1-second interval tickers
  startTimers() {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    
    this.timerIntervalId = setInterval(() => {
      this.exerciseElapsed++;
      this.sessionElapsed++;
    }, 1000);
  }

  stopTimers() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  handleVisibilityChange() {
    // If the page is hidden, automatically pause active exercise recording to prevent blank spaces.
    if (document.hidden && this.recState === 'active') {
      console.log("Window hidden: Auto-pausing practice");
      this.pausePractice();
    }
  }

  // ------------------------------------------------------------------------
  // CANVAS OVERLAY RENDER LOOP (30 FPS)
  // ------------------------------------------------------------------------
  drawCanvasLoop(timestamp) {
    if (!this.webcamStream) return;

    // Clear Canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Save context for Mirror inversion
    this.ctx.save();
    
    if (this.mirrorToggle.checked) {
      // Invert horizontally (Webcam Mirror effect)
      this.ctx.translate(this.canvasWidth, 0);
      this.ctx.scale(-1, 1);
    }

    // Draw camera frame matching the 16:9 aspect crop
    const cw = this.canvasWidth;
    const ch = this.canvasHeight;
    const vw = this.hiddenVideo.videoWidth || cw;
    const vh = this.hiddenVideo.videoHeight || ch;

    const targetAspect = cw / ch;
    const videoAspect = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;

    if (videoAspect > targetAspect) {
      sw = vh * targetAspect;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetAspect;
      sy = (vh - sh) / 2;
    }

    this.ctx.drawImage(this.hiddenVideo, sx, sy, sw, sh, 0, 0, cw, ch);

    // Restore context so the overlay labels and texts ARE NOT MIRRORED
    this.ctx.restore();

    // Draw the Broadcast Style Studio Overlay
    this.drawOverlayBox();

    // Recurse at ~30-60fps
    this.animationFrameId = requestAnimationFrame((t) => this.drawCanvasLoop(t));
  }

  drawOverlayBox() {
    const currentDay = this.routine.days[this.currentDayIndex];
    const currentEx = currentDay.exercises[this.currentExerciseIndex];

    const cw = this.canvasWidth;
    const ch = this.canvasHeight;
    const padding = 40;

    // Helper: draw text with shadow for better visibility over video
    const drawTextWithShadow = (text, x, y, font, color, align = 'left') => {
      this.ctx.font = font;
      this.ctx.textAlign = align;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillText(text, x + 2, y + 2); // shadow
      this.ctx.fillStyle = color;
      this.ctx.fillText(text, x, y);
    };

    const truncateText = (text, maxWidth) => {
      if (this.ctx.measureText(text).width <= maxWidth) return text;
      let ellipsis = '...';
      let truncated = text;
      while (truncated.length > 0 && this.ctx.measureText(truncated + ellipsis).width > maxWidth) {
        truncated = truncated.slice(0, -1);
      }
      return truncated + ellipsis;
    };

    // --- Viewfinder Corners ---
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 3;
    const bracketSize = 30;
    const inset = 20;

    this.ctx.beginPath();
    // Top-Left
    this.ctx.moveTo(inset, inset + bracketSize);
    this.ctx.lineTo(inset, inset);
    this.ctx.lineTo(inset + bracketSize, inset);
    // Top-Right
    this.ctx.moveTo(cw - inset - bracketSize, inset);
    this.ctx.lineTo(cw - inset, inset);
    this.ctx.lineTo(cw - inset, inset + bracketSize);
    // Bottom-Left
    this.ctx.moveTo(inset, ch - inset - bracketSize);
    this.ctx.lineTo(inset, ch - inset);
    this.ctx.lineTo(inset + bracketSize, ch - inset);
    // Bottom-Right
    this.ctx.moveTo(cw - inset - bracketSize, ch - inset);
    this.ctx.lineTo(cw - inset, ch - inset);
    this.ctx.lineTo(cw - inset, ch - inset - bracketSize);
    this.ctx.stroke();

    // --- TOP LEFT: REC Indicator and Date/Time ---
    let recText = 'STANDBY';
    let recColor = '#64748B';
    let drawRedDot = true;

    if (this.recState === 'active') {
      recText = 'REC';
      recColor = '#EF4444';
      drawRedDot = Math.floor(Date.now() / 500) % 2 === 0;
    } else if (this.recState === 'paused') {
      recText = 'PAUSE';
      recColor = '#F59E0B';
    }

    if (drawRedDot || this.recState !== 'active') {
      this.ctx.fillStyle = recColor;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = 4;
      this.ctx.beginPath();
      this.ctx.arc(padding + 10, padding + 15, 8, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // reset
    }

    drawTextWithShadow(recText, padding + 30, padding + 21, 'bold 24px "Inter", sans-serif', recColor, 'left');

    const now = new Date();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    drawTextWithShadow(`${day} ${month} ${year} | ${hrs}:${mins}:${secs}`, padding + 2, padding + 55, '16px "JetBrains Mono", monospace', '#CBD5E1', 'left');

    // --- TOP RIGHT: Day Title and Exercise ---
    const maxTitleWidth = 400;
    const dayTitle = `DÍA ${currentDay.dayNumber} • ${currentDay.title.toUpperCase()}`;
    const exTitle = `🎸 Ejercicio: ${currentEx.name}`;
    
    this.ctx.font = 'bold 22px "Inter", sans-serif'; // Set font before measuring
    const truncatedDayTitle = truncateText(dayTitle, maxTitleWidth);
    drawTextWithShadow(truncatedDayTitle, cw - padding, padding + 21, 'bold 22px "Inter", sans-serif', '#FFF', 'right');

    this.ctx.font = '18px "Inter", sans-serif'; // Set font before measuring
    const truncatedExTitle = truncateText(exTitle, maxTitleWidth);
    drawTextWithShadow(truncatedExTitle, cw - padding, padding + 55, '18px "Inter", sans-serif', '#10B981', 'right');

    const nextEx = currentDay.exercises[this.currentExerciseIndex + 1];
    const nextTitle = nextEx ? `Siguiente: ${nextEx.name}` : 'Siguiente: Fin de Sesión 🎉';
    this.ctx.font = 'italic 14px "Inter", sans-serif'; // Set font before measuring
    const truncatedNextTitle = truncateText(nextTitle, maxTitleWidth);
    drawTextWithShadow(truncatedNextTitle, cw - padding, padding + 80, 'italic 14px "Inter", sans-serif', '#64748B', 'right');

    // --- BOTTOM CENTER: Timers ---
    const formattedExElapsed = this.formatTime(this.exerciseElapsed);
    const formattedExTarget = this.formatTime(currentEx.duration);
    const formattedSesElapsed = this.formatTime(this.sessionElapsed);

    const timerBoxWidth = 560;
    const timerBoxHeight = 60;
    const timerBoxX = (cw - timerBoxWidth) / 2;
    const timerBoxY = ch - padding - timerBoxHeight;

    // Timer Box Background
    this.ctx.fillStyle = 'rgba(11, 15, 25, 0.75)';
    this.ctx.strokeStyle = this.recState === 'active' ? '#10B981' : (this.recState === 'paused' ? '#F59E0B' : '#64748B');
    this.ctx.lineWidth = 2;
    this.drawRoundedRect(this.ctx, timerBoxX, timerBoxY, timerBoxWidth, timerBoxHeight, 10);
    this.ctx.fill();
    this.ctx.stroke();

    // Timer Texts
    const textY = timerBoxY + 38;
    drawTextWithShadow(`EJERCICIO:`, timerBoxX + 30, textY, '16px "Inter", sans-serif', '#94A3B8', 'left');
    drawTextWithShadow(`${formattedExElapsed} / ${formattedExTarget}`, timerBoxX + 130, textY, 'bold 22px "JetBrains Mono", monospace', '#FFF', 'left');

    // Vertical Divider
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(timerBoxX + 315, timerBoxY + 15);
    this.ctx.lineTo(timerBoxX + 315, timerBoxY + 45);
    this.ctx.stroke();

    drawTextWithShadow(`SESIÓN:`, timerBoxX + 345, textY, '16px "Inter", sans-serif', '#94A3B8', 'left');
    drawTextWithShadow(`${formattedSesElapsed}`, timerBoxX + 425, textY, 'bold 22px "JetBrains Mono", monospace', '#10B981', 'left');
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  // ------------------------------------------------------------------------
  // VISTA 3: RESUMEN Y DESCARGA
  // ------------------------------------------------------------------------
  showSummaryView() {
    this.cleanupStudioStreams();

    // Revoke previous URL to release memory (Important system safety)
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }

    // Build the video blob
    const mimeType = this.recordedChunks[0]?.type || 'video/webm';
    const videoBlob = new Blob(this.recordedChunks, { type: mimeType });
    this.videoObjectUrl = URL.createObjectURL(videoBlob);

    // Set video src
    this.finalVideoPlayer.src = this.videoObjectUrl;
    this.finalVideoPlayer.load();

    // Populate Metrics
    const currentDay = this.routine.days[this.currentDayIndex];
    const totalExercises = currentDay.exercises.length;

    // Formatted date string
    const now = new Date();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    this.summaryDate.textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} | ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    this.summaryTime.textContent = this.formatTime(this.sessionElapsed);
    this.summaryExercises.textContent = `${totalExercises} de ${totalExercises}`;

    // Switch View
    this.switchView('summary');
  }

  downloadVideo() {
    if (!this.videoObjectUrl) return;

    const currentDay = this.routine.days[this.currentDayIndex];
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Sanitize titles
    const sanitizedTitle = currentDay.title.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Determine extension based on chunk mime type
    const mimeType = this.recordedChunks[0]?.type || 'video/webm';
    const isMp4 = mimeType.includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';

    const filenameBase = `Sesion_Dia${currentDay.dayNumber}_${sanitizedTitle}_${dateStr}`;
    const filename = `${filenameBase}.${ext}`;

    const a = document.createElement('a');
    a.href = this.videoObjectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Download JSON segments data
    if (this.recordedSegments && this.recordedSegments.length > 0) {
      const jsonContent = {
        routineDay: currentDay.dayNumber,
        date: dateStr,
        segments: this.recordedSegments
      };
      
      const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      
      const aJson = document.createElement('a');
      aJson.href = jsonUrl;
      aJson.download = `${filenameBase}.json`;
      document.body.appendChild(aJson);
      aJson.click();
      document.body.removeChild(aJson);
      
      setTimeout(() => URL.revokeObjectURL(jsonUrl), 100);
    }
  }

  backToDashboard() {
    // Revoke URL to release memory if not downloaded
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }

    this.switchView('dashboard');
    this.renderDashboard();
  }

  // ------------------------------------------------------------------------
  // SETTINGS DIALOG (VISUAL EDITOR)
  // ------------------------------------------------------------------------
  openConfigModal() {
    this.openVisualEditor();
  }

  closeConfigModal() {
    this.modalConfig.close();
  }

  async resetToDefaultRoutine() {
    if (confirm("¿Estás seguro de que deseas restablecer la rutina original de 12 días? Esto borrará tus personalizaciones.")) {
      localStorage.removeItem('studio_room_routine');
      await this.loadRoutineFromFile();
      this.jsonRoutineInput.value = JSON.stringify(this.routine, null, 2);
      this.closeConfigModal();
    }
  }

  saveConfigRoutine() {
    const rawVal = this.jsonRoutineInput.value;
    try {
      const parsed = JSON.parse(rawVal);
      
      // Basic JSON validation
      if (!parsed.days || !Array.isArray(parsed.days)) {
        throw new Error("El plan de rutina debe tener una lista de 'days'.");
      }

      this.routine = parsed;
      localStorage.setItem('studio_room_routine', JSON.stringify(this.routine));
      
      this.renderDashboard();
      this.closeConfigModal();
    } catch (err) {
      console.error(err);
      this.jsonErrorMsg.textContent = `❌ JSON Inválido: ${err.message}`;
      this.jsonErrorMsg.style.display = 'block';
    }
  }

  // ==========================================================================
  // EDITOR VISUAL DE RUTINA
  // ==========================================================================
  openVisualEditor() {
    this.editor = new RoutineEditor(this.routine, this);
    this.editor.open();
  }
}

/* ==========================================================================
   ROUTINE EDITOR - Editor Visual para Días y Ejercicios
   ========================================================================== */
class RoutineEditor {
  constructor(routine, appInstance) {
    this.app = appInstance;
    this.workingCopy = JSON.parse(JSON.stringify(routine));
    this.selectedDayIndex = null;
    this.selectedExerciseIndex = null;
    this.hasUnsavedChanges = false;
    this.draggedExerciseIndex = null;
    this.isJsonEditing = false; // Bandera para evitar bucles de sincronización
    
    this.initDOMElements();
    this.bindEvents();
  }

  initDOMElements() {
    this.modal = document.getElementById('modalEditor');
    this.daysList = document.getElementById('editorDaysList');
    this.btnAddDay = document.getElementById('btnAddDay');
    this.btnDeleteDay = document.getElementById('btnDeleteDay');
    
    this.emptyState = document.getElementById('editorEmptyState');
    this.dayContent = document.getElementById('editorDayContent');
    this.dayTitleInput = document.getElementById('editorDayTitle');
    this.dayDurationInput = document.getElementById('editorDayDuration');
    
    this.exercisesList = document.getElementById('editorExercisesList');
    this.btnAddExercise = document.getElementById('btnAddExercise');
    this.exerciseDetail = document.getElementById('editorExerciseDetail');
    this.exNameInput = document.getElementById('editorExName');
    this.exDurationInput = document.getElementById('editorExDuration');
    this.exNotesInput = document.getElementById('editorExNotes');
    
    this.jsonEditor = document.getElementById('jsonEditor');
    this.btnFormatJson = document.getElementById('btnFormatJson');
    this.jsonErrorMsg = document.getElementById('jsonErrorMsg');
    this.unsavedIndicator = document.getElementById('unsavedIndicator');
    this.btnSaveEditor = document.getElementById('btnSaveEditor');
    this.btnCancelEditor = document.getElementById('btnCancelEditor');
    this.btnCloseEditor = document.getElementById('btnCloseEditor');
  }

  bindEvents() {
    // Días
    this.btnAddDay.addEventListener('click', () => this.createDay());
    this.btnDeleteDay.addEventListener('click', () => this.deleteDay());
    this.dayTitleInput.addEventListener('input', () => this.updateDayData());
    this.dayDurationInput.addEventListener('input', () => this.updateDayData());
    
    // Ejercicios
    this.btnAddExercise.addEventListener('click', () => this.createExercise());
    this.exNameInput.addEventListener('input', () => this.updateExerciseData());
    this.exDurationInput.addEventListener('input', () => this.updateExerciseData());
    this.exNotesInput.addEventListener('input', () => this.updateExerciseData());
    
    // Duration presets
    document.querySelectorAll('.duration-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const duration = parseInt(e.target.dataset.duration, 10);
        this.exDurationInput.value = duration;
        this.updateExerciseData();
      });
    });
    
    // Editor JSON
    this.btnFormatJson.addEventListener('click', () => this.formatJson());
    this.jsonEditor.addEventListener('input', () => this.handleJsonEdit());
    this.jsonEditor.addEventListener('blur', () => this.handleJsonEdit());
    
    // Guardar / Cancelar
    this.btnSaveEditor.addEventListener('click', () => this.save());
    this.btnCancelEditor.addEventListener('click', () => this.cancel());
    this.btnCloseEditor.addEventListener('click', () => this.cancel());
    
    // Cerrar modal al hacer click fuera
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.cancel();
    });
    
    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
      if (!this.modal.open) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.save();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.createDay();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Shift' && e.key === 'F') {
        e.preventDefault();
        this.formatJson();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    });
  }

  open() {
    this.render();
    this.modal.showModal();
  }

  close() {
    this.modal.close();
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  render() {
    this.renderDaysList();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
    
    if (this.selectedDayIndex !== null) {
      this.showDayEditor();
      this.renderExercisesList();
    } else {
      this.showEmptyState();
    }
  }

  renderDaysList() {
    this.daysList.innerHTML = '';
    
    this.workingCopy.days.forEach((day, index) => {
      const item = document.createElement('div');
      item.className = `editor-day-item${index === this.selectedDayIndex ? ' selected' : ''}`;
      item.innerHTML = `
        <span class="day-num">D${day.dayNumber}</span>
        <span class="day-name">${day.title || 'Sin título'}</span>
      `;
      item.addEventListener('click', () => this.selectDay(index));
      this.daysList.appendChild(item);
    });
    
    // Habilitar/deshabilitar botón eliminar
    this.btnDeleteDay.disabled = this.selectedDayIndex === null;
  }

  showEmptyState() {
    this.emptyState.style.display = 'flex';
    this.dayContent.style.display = 'none';
  }

  showDayEditor() {
    this.emptyState.style.display = 'none';
    this.dayContent.style.display = 'block';
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    this.dayTitleInput.value = day.title || '';
    this.dayDurationInput.value = day.durationMinutes || 50;
    
    this.btnDeleteDay.disabled = false;
  }

  renderExercisesList() {
    this.exercisesList.innerHTML = '';
    
    if (this.selectedDayIndex === null) return;
    
    const exercises = this.workingCopy.days[this.selectedDayIndex].exercises || [];
    
    if (exercises.length === 0) {
      this.exercisesList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #fff; font-size: 0.85rem;">
          <p>No hay ejercicios en este día</p>
          <p style="font-size: 0.75rem; margin-top: 0.5rem;">Usa el botón "+ Agregar" para crear uno</p>
        </div>
      `;
      this.hideExerciseDetail();
      return;
    }
    
    exercises.forEach((ex, index) => {
      const item = document.createElement('div');
      item.className = `editor-exercise-item${index === this.selectedExerciseIndex ? ' selected' : ''}`;
      item.draggable = true;
      item.dataset.index = index;
      item.innerHTML = `
        <span class="drag-handle" title="Arrastra para reordenar">⋮⋮</span>
        <div class="ex-info">
          <div class="ex-name">${ex.name || 'Sin nombre'}</div>
          <div class="ex-duration">${this.formatDuration(ex.duration)} (${ex.duration}s)</div>
        </div>
        <button class="ex-delete-btn" data-index="${index}">🗑️</button>
      `;
      
      // Event listeners para click (seleccionar / eliminar)
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('ex-delete-btn') && !e.target.classList.contains('drag-handle')) {
          this.selectExercise(index);
        }
      });
      
      item.querySelector('.ex-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteExercise(index);
      });
      
      // Event listeners para drag & drop
      item.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
      item.addEventListener('dragover', (e) => this.handleDragOver(e, index));
      item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
      item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      item.addEventListener('drop', (e) => this.handleDrop(e, index));
      item.addEventListener('dragend', () => this.handleDragEnd());
      
      this.exercisesList.appendChild(item);
    });
  }

  showExerciseDetail() {
    this.exerciseDetail.classList.remove('hidden');
    const ex = this.workingCopy.days[this.selectedDayIndex].exercises[this.selectedExerciseIndex];
    this.exNameInput.value = ex.name || '';
    this.exDurationInput.value = ex.duration || 600;
    this.exNotesInput.value = ex.notes || '';
  }

  hideExerciseDetail() {
    this.exerciseDetail.classList.add('hidden');
  }

  // =========================================================================
  // OPERACIONES DE DÍA
  // =========================================================================
  createDay() {
    const newDayNumber = this.workingCopy.days.length > 0 
      ? Math.max(...this.workingCopy.days.map(d => d.dayNumber)) + 1 
      : 1;
    
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const newDay = {
      dayNumber: newDayNumber,
      title: `Nuevo Día - ${dateStr}`,
      durationMinutes: 50,
      exercises: []
    };
    
    this.workingCopy.days.push(newDay);
    this.selectedDayIndex = this.workingCopy.days.length - 1;
    this.selectedExerciseIndex = null;
    this.hasUnsavedChanges = true;
    
    this.render();
    
    // Focus en el título
    setTimeout(() => this.dayTitleInput.focus(), 100);
  }

  selectDay(index) {
    this.selectedDayIndex = index;
    this.selectedExerciseIndex = null;
    this.hideExerciseDetail();
    this.render();
  }

  updateDayData() {
    if (this.selectedDayIndex === null) return;
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    day.title = this.dayTitleInput.value;
    day.durationMinutes = parseInt(this.dayDurationInput.value, 10) || 50;
    
    this.hasUnsavedChanges = true;
    this.renderDaysList();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
  }

  deleteDay() {
    if (this.selectedDayIndex === null) return;
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    if (!confirm(`¿Eliminar el día "${day.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    this.workingCopy.days.splice(this.selectedDayIndex, 1);
    this.selectedDayIndex = null;
    this.selectedExerciseIndex = null;
    this.hideExerciseDetail();
    this.hasUnsavedChanges = true;
    this.render();
  }

  // =========================================================================
  // OPERACIONES DE EJERCICIO
  // =========================================================================
  createExercise() {
    if (this.selectedDayIndex === null) return;
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    const exNumber = (day.exercises.length > 0) 
      ? day.exercises.length + 1 
      : 1;
    
    const newExercise = {
      id: `d${day.dayNumber}_e${exNumber}`,
      name: 'Nuevo Ejercicio',
      duration: 600,
      notes: ''
    };
    
    day.exercises.push(newExercise);
    this.selectedExerciseIndex = day.exercises.length - 1;
    this.hasUnsavedChanges = true;
    
    this.renderExercisesList();
    this.showExerciseDetail();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
    
    // Focus en el nombre
    setTimeout(() => this.exNameInput.focus(), 100);
  }

  selectExercise(index) {
    this.selectedExerciseIndex = index;
    this.renderExercisesList();
    this.showExerciseDetail();
  }

  updateExerciseData() {
    if (this.selectedDayIndex === null || this.selectedExerciseIndex === null) return;
    
    const ex = this.workingCopy.days[this.selectedDayIndex].exercises[this.selectedExerciseIndex];
    ex.name = this.exNameInput.value;
    ex.duration = parseInt(this.exDurationInput.value, 10) || 600;
    ex.notes = this.exNotesInput.value;
    
    // Recalcular duración del día
    this.recalculateDayDuration();
    
    this.hasUnsavedChanges = true;
    this.renderExercisesList();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
  }

  deleteExercise(index) {
    if (this.selectedDayIndex === null) return;
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    const ex = day.exercises[index];
    
    if (!confirm(`¿Eliminar el ejercicio "${ex.name}"?`)) {
      return;
    }
    
    day.exercises.splice(index, 1);
    
    if (this.selectedExerciseIndex === index) {
      this.selectedExerciseIndex = null;
      this.hideExerciseDetail();
    } else if (this.selectedExerciseIndex > index) {
      this.selectedExerciseIndex--;
    }
    
    // Recalcular duración del día
    this.recalculateDayDuration();
    
    this.hasUnsavedChanges = true;
    this.renderExercisesList();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
  }

  // =========================================================================
  // DRAG & DROP PARA REORDENAR EJERCICIOS
  // =========================================================================
  handleDragStart(e, index) {
    this.draggedExerciseIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    
    // Añadir clase visual de arrastre
    const item = e.currentTarget;
    item.classList.add('dragging');
  }

  handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this.draggedExerciseIndex === null || this.draggedExerciseIndex === undefined) return;
    if (this.draggedExerciseIndex === index) return;
    
    // Mostrar línea de inserción
    const items = this.exercisesList.querySelectorAll('.editor-exercise-item');
    items.forEach((item, i) => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    if (e.clientY < midpoint) {
      e.currentTarget.classList.add('drag-over-top');
    } else {
      e.currentTarget.classList.add('drag-over-bottom');
    }
  }

  handleDragEnter(e) {
    e.preventDefault();
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
  }

  handleDrop(e, dropIndex) {
    e.preventDefault();
    
    if (this.draggedExerciseIndex === null || this.draggedExerciseIndex === undefined) return;
    if (this.draggedExerciseIndex === dropIndex) {
      this.resetDragState();
      return;
    }

    const exercises = this.workingCopy.days[this.selectedDayIndex].exercises;
    
    // Determinar si insertar before o after basado en la clase
    const item = e.currentTarget;
    let insertIndex = dropIndex;
    
    if (item.classList.contains('drag-over-top')) {
      insertIndex = dropIndex;
    } else if (item.classList.contains('drag-over-bottom')) {
      insertIndex = dropIndex + 1;
    }
    
    // Remover el elemento arrastrado de su posición original
    const [draggedExercise] = exercises.splice(this.draggedExerciseIndex, 1);
    
    // Ajuste: si el índice original era menor que el de soltado, 
    // el array se acortó así que ajustamos
    if (this.draggedExerciseIndex < dropIndex) {
      insertIndex = dropIndex;
    }
    
    exercises.splice(insertIndex, 0, draggedExercise);
    
    // Actualizar selección al nuevo índice
    this.selectedExerciseIndex = insertIndex;
    
    this.hasUnsavedChanges = true;
    this.resetDragState();
    this.renderExercisesList();
    this.showExerciseDetail();
    this.updateJsonPreview();
    this.updateUnsavedIndicator();
  }

  handleDragEnd() {
    this.resetDragState();
  }

  resetDragState() {
    this.draggedExerciseIndex = null;
    const items = this.exercisesList.querySelectorAll('.editor-exercise-item');
    items.forEach(item => {
      item.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
  }

  // =========================================================================
  // UTILIDADES
  // =========================================================================
  recalculateDayDuration() {
    if (this.selectedDayIndex === null) return;
    
    const day = this.workingCopy.days[this.selectedDayIndex];
    const totalSeconds = day.exercises.reduce((sum, ex) => sum + (ex.duration || 0), 0);
    day.durationMinutes = Math.ceil(totalSeconds / 60);
    this.dayDurationInput.value = day.durationMinutes;
  }

  formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  updateJsonPreview() {
    if (this.isJsonEditing) return; // No actualizar si el usuario está editando JSON
    
    this.isJsonEditing = true;
    const json = JSON.stringify(this.workingCopy, null, 2);
    this.jsonEditor.value = json;
    this.hideJsonError();
    this.jsonEditor.classList.remove('error');
    
    // Resetear la bandera después de que se procese el evento
    setTimeout(() => { this.isJsonEditing = false; }, 0);
  }

  handleJsonEdit() {
    if (this.isJsonEditing) return; // Evitar bucles de sincronización
    
    this.isJsonEditing = true;
    
    try {
      const parsed = JSON.parse(this.jsonEditor.value);
      this.workingCopy = parsed;
      this.hasUnsavedChanges = true;
      this.hideJsonError();
      this.jsonEditor.classList.remove('error');
      
      // Re-render the visual editor to reflect JSON changes
      this.selectedDayIndex = null;
      this.selectedExerciseIndex = null;
      this.render();
    } catch (err) {
      this.showJsonError(`JSON inválido: ${err.message}`);
      this.jsonEditor.classList.add('error');
    }
    
    this.updateUnsavedIndicator();
    
    // Resetear la bandera después de que se procese el evento
    setTimeout(() => { this.isJsonEditing = false; }, 0);
  }

  showJsonError(message) {
    this.jsonErrorMsg.textContent = message;
    this.jsonErrorMsg.style.display = 'block';
  }

  hideJsonError() {
    this.jsonErrorMsg.style.display = 'none';
  }

  formatJson() {
    try {
      const parsed = JSON.parse(this.jsonEditor.value);
      this.jsonEditor.value = JSON.stringify(parsed, null, 2);
      this.hideJsonError();
      this.jsonEditor.classList.remove('error');
    } catch (err) {
      this.showJsonError(`No se puede formatear: JSON inválido`);
      this.jsonEditor.classList.add('error');
    }
  }

  updateUnsavedIndicator() {
    this.unsavedIndicator.style.display = this.hasUnsavedChanges ? 'flex' : 'none';
  }

  // =========================================================================
  // PERSISTENCIA
  // =========================================================================
  validate() {
    const errors = [];
    
    if (!this.workingCopy.days || this.workingCopy.days.length === 0) {
      errors.push('La rutina debe tener al menos un día.');
      return errors;
    }
    
    this.workingCopy.days.forEach((day, i) => {
      if (!day.title) {
        errors.push(`Día ${i + 1}: Falta el título.`);
      }
      if (!day.exercises || day.exercises.length === 0) {
        errors.push(`Día ${i + 1}: Debe tener al menos un ejercicio.`);
      }
    });
    
    return errors;
  }

  save() {
    const errors = this.validate();
    
    if (errors.length > 0) {
      alert('Errores encontrados:\n\n' + errors.join('\n'));
      return;
    }
    
    // Actualizar la rutina en la app y guardar en localStorage
    this.app.routine = this.workingCopy;
    localStorage.setItem('studio_room_routine', JSON.stringify(this.workingCopy));
    
    // Refrescar el dashboard
    this.app.renderDashboard();
    
    this.hasUnsavedChanges = false;
    this.close();
  }

  cancel() {
    if (this.hasUnsavedChanges) {
      if (!confirm('¿Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?')) {
        return;
      }
    }
    this.close();
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new StudioApp();
});
