/* ═══════════════════════════════════════════════
   LearnVault — Student Dashboard JS (Full)
   ═══════════════════════════════════════════════ */
;(function () {
  'use strict';

  var $ = function(s) { return document.querySelector(s); };
  var $$ = function(s) { return document.querySelectorAll(s); };

  /* ── Session check ─────────────────────────── */
  var token = sessionStorage.getItem('token');
  var userName = sessionStorage.getItem('userName') || 'Student';
  if (!token) { window.location.href = 'student-login.html'; return; }

  $('#topbar-username').textContent = userName;
  $('#user-avatar').textContent = userName.charAt(0).toUpperCase();

  /* ── Helpers ───────────────────────────────── */
  var loader = $('#loader-overlay');
  function showLoader() { loader.classList.remove('hidden'); }
  function hideLoader() { loader.classList.add('hidden'); }

  function escHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function toast(msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toast-container').appendChild(el);
    setTimeout(function() { el.remove(); }, 3500);
  }

  function api(method, path, body) {
    var sep = path.indexOf('?') !== -1 ? '&' : '?';
    var url = path + sep + 'token=' + token;
    var opts = { method: method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function(res) {
      if (res.status === 401) {
        sessionStorage.clear();
        window.location.href = 'student-login.html';
        return Promise.reject(new Error('Session expired'));
      }
      return res.json().then(function(data) {
        if (!res.ok) return Promise.reject(new Error(data.detail || 'Error'));
        return data;
      });
    });
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ── Sidebar navigation ─────────────────────── */
  var sidebar = $('#sidebar');
  function closeSidebar() {
    sidebar.classList.remove('open');
    var bd = document.querySelector('.sidebar-backdrop');
    if (bd) bd.remove();
  }
  $('#sidebar-toggle').addEventListener('click', function() {
    if (sidebar.classList.toggle('open')) {
      var bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', closeSidebar);
      document.body.appendChild(bd);
    } else { closeSidebar(); }
  });

  var navItems = $$('.nav-item[data-view]');
  navItems.forEach(function(btn) {
    btn.addEventListener('click', function() {
      navItems.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      $$('.view').forEach(function(v) { v.classList.remove('active'); });
      var viewId = 'view-' + btn.getAttribute('data-view');
      var view = document.getElementById(viewId);
      if (view) view.classList.add('active');
      closeSidebar();
      var v = btn.getAttribute('data-view');
      if (v === 'browse') loadCatalog();
      else if (v === 'progress') loadEnrolled();
      else if (v === 'certificates') loadCertificates();
      else if (v === 'tokens') loadTickets();
      else if (v === 'profile') loadProfile();
    });
  });

  $('#logout-btn').addEventListener('click', function() {
    api('POST', '/auth/logout').catch(function(){});
    sessionStorage.clear();
    window.location.href = 'student-login.html';
  });


  /* ═══════════════════════════════════════════════
     BROWSE COURSES
     ═══════════════════════════════════════════════ */

  function loadCatalog() {
    showLoader();
    api('GET', '/student/catalog')
    .then(function(courses) {
      var grid = $('#catalog-grid');
      var empty = $('#catalog-empty');
      if (!courses.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      var icons = { programming: '💻', 'data-science': '📊', design: '🎨', business: '📈', security: '🔒' };
      grid.innerHTML = courses.map(function(c) {
        var icon = icons[c.category] || '📚';
        return '<div class="catalog-card" data-id="' + c.id + '">' +
          '<span style="font-size:2rem">' + icon + '</span>' +
          '<span class="course-badge">' + escHtml(c.category) + '</span>' +
          '<h3>' + escHtml(c.name) + '</h3>' +
          '<p>' + escHtml(c.description) + '</p>' +
          '<div class="meta"><span>' + c.module_count + ' modules</span><span>' + c.test_count + ' tests</span><span>by ' + escHtml(c.author) + '</span></div>' +
          '<button class="btn-enroll" onclick="studentApp.enroll(' + c.id + ')">Enroll Now</button>' +
          '</div>';
      }).join('');
    })
    .catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  function enrollInCourse(courseId) {
    showLoader();
    api('POST', '/student/enroll/' + courseId)
    .then(function(data) {
      toast(data.detail, 'success');
      loadCatalog();
    })
    .catch(function(err) { toast(err.message, 'error'); })
    .finally(hideLoader);
  }


  /* ═══════════════════════════════════════════════
     IN PROGRESS
     ═══════════════════════════════════════════════ */

  var enrolledCache = [];
  var currentCourseData = null;

  function loadEnrolled() {
    showLoader();
    // Hide player, show list
    $('#player-view').classList.add('hidden-view');
    $('#progress-list').style.display = '';

    api('GET', '/student/enrolled')
    .then(function(courses) {
      enrolledCache = courses;
      var list = $('#progress-list');
      var empty = $('#progress-empty');
      if (!courses.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = courses.map(function(c) {
        var hasTest = c.tests && c.tests.length > 0;
        var bestScore = hasTest && c.tests[0].best_score !== null ? c.tests[0].best_score.toFixed(1) + '%' : '—';
        return '<div class="progress-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
            '<div><h3>' + escHtml(c.name) + '</h3>' +
            '<span class="course-badge">' + escHtml(c.category) + '</span>' +
            '<span style="font-size:.78rem;color:var(--text-sec);margin-left:.5rem">by ' + escHtml(c.author) + '</span></div>' +
            '<div style="text-align:right"><span style="font-size:1.3rem;font-weight:700;color:var(--pri)">' + c.completion_pct + '%</span>' +
            '<br><span style="font-size:.75rem;color:var(--text-sec)">' + c.completed_modules + '/' + c.total_modules + ' modules</span></div>' +
          '</div>' +
          '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + c.completion_pct + '%"></div></div>' +
          '<div style="display:flex;gap:.8rem;margin-top:.6rem;align-items:center">' +
            '<button class="btn btn-primary" style="font-size:.82rem;padding:.4rem 1rem" onclick="studentApp.openCourse(' + c.course_id + ')">Continue Learning</button>' +
            (c.has_certificate ?
              '<span style="color:#22c55e;font-size:.82rem;font-weight:600">✓ Certificate Earned</span>' :
              (hasTest ? '<span style="font-size:.78rem;color:var(--text-sec)">Best Score: ' + bestScore + '</span>' : '')
            ) +
          '</div>' +
          '</div>';
      }).join('');
    })
    .catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  function openCoursePlayer(courseId) {
    var c = enrolledCache.find(function(x) { return x.course_id === courseId; });
    if (!c) return;
    currentCourseData = c;

    // Hide list, show player
    $('#progress-list').style.display = 'none';
    $('#progress-empty').classList.add('hidden');
    $('#player-view').classList.remove('hidden-view');
    $('#player-course-title').textContent = c.name;

    renderModuleList(c);
    renderTestSection(c);

    // Auto-load first module
    if (c.modules.length) {
      loadModule(c.modules[0]);
    }
  }

  function renderModuleList(c) {
    var ul = $('#module-list');
    ul.innerHTML = c.modules.map(function(m) {
      var icon = m.content_type === 'video' ? '🎬' : '📄';
      return '<li class="' + (m.completed ? 'done' : '') + '" data-mid="' + m.id + '" onclick="studentApp.playModule(' + m.id + ')">' +
        '<span class="check">' + (m.completed ? '✓' : '') + '</span>' +
        '<span class="icon">' + icon + '</span>' +
        '<span>' + escHtml(m.title) + '</span></li>';
    }).join('');
  }

  function loadModule(m) {
    var area = $('#player-area');
    if (m.content_type === 'video') {
      var src = m.url || (m.file_path ? m.file_path : '');
      if (!src) {
        area.innerHTML = '<div class="text-reader"><p>No video available for this module.</p>' +
          '<button class="btn btn-primary" onclick="studentApp.markDone(' + m.id + ')">Mark as Complete</button></div>';
      } else {
        var lastTime = 0;
        area.innerHTML = '<video autoplay style="width:100%;aspect-ratio:16/9;background:#000;border-radius:8px" id="active-video"><source src="' + escHtml(src) + '" type="video/mp4"></video>' +
          '<div style="padding:.4rem .8rem;font-size:.78rem;color:var(--text-sec);text-align:center">⚠ Video cannot be skipped — watch to the end to mark as complete</div>';
        var vid = $('#active-video');
        // Prevent seeking/skipping
        vid.addEventListener('timeupdate', function() {
          if (vid.currentTime > lastTime + 2) {
            vid.currentTime = lastTime;
          } else {
            lastTime = vid.currentTime;
          }
        });
        vid.addEventListener('ended', function() {
          markModuleComplete(m);
        });
      }
    } else {
      var src = m.url || m.file_path || '';
      if (src) {
        var ext = src.split('.').pop().toLowerCase();
        if (ext === 'pdf') {
          // PDF: native browser embed
          area.innerHTML = '<iframe src="' + escHtml(src) + '" style="width:100%;height:600px;border:none;border-radius:8px"></iframe>' +
            '<div style="padding:.8rem;text-align:center"><button class="btn btn-primary" onclick="studentApp.markDone(' + m.id + ')">Mark as Complete</button></div>';
        } else if (ext === 'pptx' || ext === 'docx') {
          // PPTX/DOCX: server-side conversion to HTML
          area.innerHTML = '<iframe src="/preview/' + m.id + '" style="width:100%;height:600px;border:none;border-radius:8px;background:#f8f9fa"></iframe>' +
            '<div style="padding:.8rem;text-align:center"><button class="btn btn-primary" onclick="studentApp.markDone(' + m.id + ')">Mark as Complete</button></div>';
        } else {
          // Plain text / md / html — fetch and display inline
          area.innerHTML = '<div class="text-reader" style="padding:1.5rem;background:#f8f9fa;border-radius:8px;min-height:300px;max-height:600px;overflow-y:auto;line-height:1.8;font-size:.95rem">' +
            '<div id="text-content-body" style="white-space:pre-wrap;font-family:inherit">Loading content...</div></div>' +
            '<div style="padding:.8rem;text-align:center"><button class="btn btn-primary" onclick="studentApp.markDone(' + m.id + ')">Mark as Complete</button></div>';
          fetch(src).then(function(r) { return r.text(); }).then(function(text) {
            var body = document.getElementById('text-content-body');
            if (body) body.textContent = text;
          }).catch(function() {
            var body = document.getElementById('text-content-body');
            if (body) body.innerHTML = '<p style="color:#ef4444">Could not load content. <a href="' + escHtml(src) + '" target="_blank" style="color:var(--pri)">Open in new tab</a></p>';
          });
        }
      } else {
        area.innerHTML = '<div class="text-reader" style="padding:2rem;text-align:center;color:var(--text-sec)"><p>No content available for this module.</p>' +
          '<button class="btn btn-primary" onclick="studentApp.markDone(' + m.id + ')">Mark as Complete</button></div>';
      }
    }
    // Highlight in list
    $$('#module-list li').forEach(function(li) { li.style.background = ''; });
    var active = document.querySelector('#module-list li[data-mid="' + m.id + '"]');
    if (active) active.style.background = 'rgba(109,90,205,.15)';
  }

  function playModuleById(moduleId) {
    if (!currentCourseData) return;
    var m = currentCourseData.modules.find(function(x) { return x.id === moduleId; });
    if (m) loadModule(m);
  }

  function markModuleComplete(m) {
    if (!currentCourseData || m.completed) return;
    api('POST', '/student/progress?course_id=' + currentCourseData.course_id + '&module_id=' + m.id)
    .then(function() {
      m.completed = true;
      currentCourseData.completed_modules++;
      currentCourseData.completion_pct = Math.round(currentCourseData.completed_modules / currentCourseData.total_modules * 100 * 10) / 10;
      renderModuleList(currentCourseData);
      renderTestSection(currentCourseData);
      toast('Module completed!', 'success');
    })
    .catch(function(err) { /* already marked */ });
  }

  function markModuleDone(moduleId) {
    if (!currentCourseData) return;
    var m = currentCourseData.modules.find(function(x) { return x.id === moduleId; });
    if (m) markModuleComplete(m);
  }

  function renderTestSection(c) {
    var section = $('#test-section');
    if (!c.tests || !c.tests.length) {
      section.style.display = 'none';
      return;
    }
    var test = c.tests[0];
    section.style.display = '';
    $('#test-title').textContent = test.title;
    var btn = $('#btn-start-test');

    if (test.attempts_used >= test.max_attempts) {
      $('#test-attempts').textContent = 'All ' + test.max_attempts + ' attempts used. Best: ' + (test.best_score !== null ? test.best_score.toFixed(1) + '%' : '—');
      btn.textContent = 'No Attempts Left';
      btn.disabled = true;
      btn.style.opacity = '.5';
      // Show claim cert button if score >= 70%
      if (!c.has_certificate && test.best_score !== null && test.best_score >= 70) {
        section.innerHTML += '<button class="btn btn-primary" style="width:100%;margin-top:.5rem;background:#22c55e" onclick="studentApp.claimCert(' + c.course_id + ')">🎓 Claim Certificate</button>';
      } else if (!c.has_certificate && test.best_score !== null && test.best_score < 70) {
        section.innerHTML += '<p style="color:#ef4444;font-size:.85rem;margin-top:.5rem;text-align:center">Minimum 70% required for certificate. Your best: ' + test.best_score.toFixed(1) + '%</p>';
      }
    } else if (!c.all_modules_done) {
      $('#test-attempts').textContent = 'Complete all modules to unlock this test. (' + test.attempts_used + '/' + test.max_attempts + ' attempts used)';
      btn.textContent = '🔒 Test Locked';
      btn.disabled = true;
      btn.style.opacity = '.5';
    } else {
      var attemptsLeft = test.max_attempts - test.attempts_used;
      $('#test-attempts').innerHTML = '<strong>' + attemptsLeft + '</strong> attempt' + (attemptsLeft !== 1 ? 's' : '') + ' remaining' +
        (test.time_limit_minutes ? ' • <strong>' + test.time_limit_minutes + ' min</strong> time limit' : '') +
        (test.best_score !== null ? ' • Best: ' + test.best_score.toFixed(1) + '%' : '');
      btn.textContent = '▶ Start Test';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.onclick = function() { startAntiCheatTest(c.course_id, test.id); };
      // Show claim cert button if score >= 70%
      if (!c.has_certificate && test.best_score !== null && test.best_score >= 70) {
        var claimBtn = document.createElement('button');
        claimBtn.className = 'btn btn-primary';
        claimBtn.style.cssText = 'width:100%;margin-top:.5rem;background:#22c55e';
        claimBtn.textContent = '🎓 Claim Certificate';
        claimBtn.onclick = function() { claimCertificate(c.course_id); };
        section.appendChild(claimBtn);
      } else if (!c.has_certificate && test.best_score !== null && test.best_score < 70) {
        var warnP = document.createElement('p');
        warnP.style.cssText = 'color:#ef4444;font-size:.85rem;margin-top:.5rem;text-align:center';
        warnP.textContent = 'Minimum 70% required for certificate. Your best: ' + test.best_score.toFixed(1) + '%';
        section.appendChild(warnP);
      }
    }
  }

  $('#back-to-progress').addEventListener('click', function() {
    $('#player-view').classList.add('hidden-view');
    currentCourseData = null;
    loadEnrolled();
  });


  /* ═══════════════════════════════════════════════
     ANTI-CHEAT TEST PLAYER
     ═══════════════════════════════════════════════ */

  function startAntiCheatTest(courseId, testId) {
    showLoader();
    api('GET', '/student/test/' + testId)
    .then(function(data) {
      hideLoader();
      launchTestOverlay(courseId, data.test, data.questions);
    })
    .catch(function(err) { toast(err.message, 'error'); hideLoader(); });
  }

  function launchTestOverlay(courseId, test, questions) {
    var root = $('#test-overlay-root');
    var timeLeft = (test.time_limit_minutes || 30) * 60;
    var warnings = 0;
    var maxWarnings = 3;
    var submitted = false;

    // Build HTML — MCQ only
    var qHtml = questions.map(function(q, i) {
      var inner = '';
      if (q.options) {
        inner = q.options.filter(function(opt) { return opt; }).map(function(opt, oi) {
          return '<label style="display:block;padding:.4rem .6rem;margin:.25rem 0;border-radius:6px;cursor:pointer;transition:background .15s"><input type="radio" name="q-' + q.id + '" value="' + oi + '" style="margin-right:.5rem"> ' + escHtml(opt) + '</label>';
        }).join('');
      }
      return '<div class="question-card"><h4>Q' + (i+1) + '. ' + escHtml(q.question) + ' <span style="color:var(--text-sec);font-size:.75rem">(' + q.marks + ' marks)</span></h4>' + inner + '</div>';
    }).join('');

    root.innerHTML = '<div class="test-overlay" id="test-overlay">' +
      '<div class="test-header"><div><strong>' + escHtml(test.title) + '</strong></div>' +
      '<div id="test-warn-display" class="test-warnings" style="display:none">⚠ Tab switch warnings: <span id="warn-count">0</span>/' + maxWarnings + '</div>' +
      '<div class="test-timer" id="test-timer"></div></div>' +
      '<div class="test-body"><form id="test-form">' + qHtml +
      '<button type="submit" class="btn btn-primary" style="width:100%;padding:.7rem;font-size:1rem;margin-top:1rem">Submit Test</button>' +
      '</form></div></div>';

    // Timer
    function updateTimer() {
      if (submitted) return;
      var m = Math.floor(timeLeft / 60);
      var s = timeLeft % 60;
      var el = document.getElementById('test-timer');
      if (el) {
        el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        if (timeLeft <= 60) el.classList.add('warning');
      }
      if (timeLeft <= 0) {
        submitTest();
        return;
      }
      timeLeft--;
      setTimeout(updateTimer, 1000);
    }
    updateTimer();

    // Anti-cheat: tab switch / minimize detection
    function handleVisibility() {
      if (submitted) return;
      if (document.hidden) {
        warnings++;
        var warnEl = document.getElementById('warn-count');
        var warnBox = document.getElementById('test-warn-display');
        if (warnEl) warnEl.textContent = warnings;
        if (warnBox) warnBox.style.display = '';
        if (warnings >= maxWarnings) {
          toast('Test auto-submitted: too many tab switches!', 'error');
          submitTest();
        } else {
          toast('Warning ' + warnings + '/' + maxWarnings + ': Do not switch tabs!', 'error');
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    function handleBlur() {
      if (submitted) return;
      warnings++;
      var warnEl = document.getElementById('warn-count');
      var warnBox = document.getElementById('test-warn-display');
      if (warnEl) warnEl.textContent = warnings;
      if (warnBox) warnBox.style.display = '';
      if (warnings >= maxWarnings) {
        toast('Test auto-submitted: too many focus losses!', 'error');
        submitTest();
      }
    }
    window.addEventListener('blur', handleBlur);

    // Request fullscreen
    try {
      var overlay = document.getElementById('test-overlay');
      if (overlay && overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(function(){});
      }
    } catch(e) {}

    // Submit
    function submitTest() {
      if (submitted) return;
      submitted = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(function(){});
      }

      var answers = questions.map(function(q) {
        var ans = { question_id: q.id };
        var sel = document.querySelector('input[name="q-' + q.id + '"]:checked');
        ans.selected_option = sel ? parseInt(sel.value) : -1;
        return ans;
      });

      showLoader();
      api('POST', '/submit_mcq/', { course_id: courseId, test_id: test.id, answers: answers })
  
      .then(function(result) {
        root.innerHTML = '';
        toast('Test submitted! Score: ' + result.score + '/' + result.total + ' (' + result.percentage + '%)', 'success');
        // Refresh enrolled data
        loadEnrolled();
      })
      .catch(function(err) {
        root.innerHTML = '';
        toast('Submit error: ' + err.message, 'error');
      })
      .finally(hideLoader);
    }

    document.getElementById('test-form').addEventListener('submit', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to submit? You cannot change your answers after submission.')) {
        submitTest();
      }
    });
  }


  /* ═══════════════════════════════════════════════
     CERTIFICATES
     ═══════════════════════════════════════════════ */

  function loadCertificates() {
    showLoader();
    api('GET', '/student/certificates')
    .then(function(certs) {
      var list = $('#certs-list');
      var empty = $('#certs-empty');
      if (!certs.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = certs.map(function(c) {
        return '<div class="cert-card">' +
          '<div class="cert-icon">🎓</div>' +
          '<div class="cert-info"><h3>' + escHtml(c.course_name) + '</h3>' +
          '<p>Score: ' + c.score_percentage.toFixed(1) + '% • Issued: ' + fmtDate(c.issued_at) + '</p></div>' +
          '<a class="btn-download" href="' + escHtml(c.file_path) + '" target="_blank" download>Download PDF</a>' +
          '</div>';
      }).join('');
    })
    .catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  function claimCertificate(courseId) {
    showLoader();
    api('POST', '/student/certificate/' + courseId)

    .then(function(data) {
      toast(data.detail || 'Certificate generated!', 'success');
      // Switch to certificates view
      navItems.forEach(function(b) { b.classList.remove('active'); });
      document.querySelector('.nav-item[data-view="certificates"]').classList.add('active');
      $$('.view').forEach(function(v) { v.classList.remove('active'); });
      $('#view-certificates').classList.add('active');
      loadCertificates();
    })
    .catch(function(err) { toast(err.message, 'error'); })
    .finally(hideLoader);
  }


  /* ═══════════════════════════════════════════════
     TOKENS
     ═══════════════════════════════════════════════ */

  function loadTickets() {
    showLoader();
    api('GET', '/student/tokens')
    .then(function(tickets) {
      var list = $('#tickets-list');
      var empty = $('#tickets-empty');
      if (!tickets.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = tickets.map(function(t) {
        var statusClass = t.status === 'closed' ? 'tag-closed' : (t.status === 'in_progress' ? 'tag-in_progress' : 'tag-open');
        return '<div class="ticket-card">' +
          '<div class="ticket-head"><h4>' + escHtml(t.subject) + '</h4><span class="tag ' + statusClass + '">' + t.status.replace('_', ' ') + '</span></div>' +
          '<p style="font-size:.88rem;color:var(--text-sec);margin:.3rem 0">' + escHtml(t.body) + '</p>' +
          '<span style="font-size:.72rem;color:var(--text-sec)">' + fmtDate(t.created_at) + '</span>' +
          (t.admin_reply ? '<div class="ticket-reply"><strong>Admin Reply:</strong> ' + escHtml(t.admin_reply) + '</div>' : '') +
          '</div>';
      }).join('');
    })
    .catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  $('#btn-new-ticket').addEventListener('click', function() {
    var root = $('#modal-root');
    root.innerHTML = '<div class="modal-overlay" id="modal-overlay"><div class="modal-box">' +
      '<button class="modal-close" id="modal-close-btn">&times;</button>' +
      '<h2>Raise a Ticket</h2>' +
      '<form id="ticket-form" autocomplete="off">' +
      '<div class="form-field"><label>Subject</label><input type="text" id="tk-subject" required /></div>' +
      '<div class="form-field"><label>Message</label><textarea id="tk-body" rows="4" required></textarea></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Submit Ticket</button>' +
      '</form></div></div>';
    $('#modal-close-btn').addEventListener('click', function() { root.innerHTML = ''; });
    $('#modal-overlay').addEventListener('click', function(e) { if (e.target.id === 'modal-overlay') root.innerHTML = ''; });
    $('#ticket-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var data = { subject: $('#tk-subject').value.trim(), body: $('#tk-body').value.trim() };
      showLoader();
      api('POST', '/student/token', data)
  
      .then(function() {
        root.innerHTML = '';
        toast('Ticket submitted!', 'success');
        loadTickets();
      })
      .catch(function(err) { toast(err.message, 'error'); })
      .finally(hideLoader);
    });
  });


  /* ═══════════════════════════════════════════════
     PROFILE
     ═══════════════════════════════════════════════ */

  function loadProfile() {
    showLoader();
    api('GET', '/student/profile')
    .then(function(p) {
      var content = $('#profile-content');
      content.innerHTML =
        '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">' +
          '<div class="avatar" style="width:56px;height:56px;font-size:1.5rem">' + escHtml(p.first_name.charAt(0)) + '</div>' +
          '<div><h2 style="margin:0">' + escHtml(p.first_name + ' ' + p.last_name) + '</h2>' +
          '<p style="margin:0;color:var(--text-sec);font-size:.85rem">' + escHtml(p.email) + '</p></div>' +
        '</div>' +
        '<div class="profile-stat">' +
          '<div><div class="num">' + p.enrolled_courses + '</div><div class="label">Enrolled Courses</div></div>' +
          '<div><div class="num">' + p.certificates_earned + '</div><div class="label">Certificates</div></div>' +
          '<div><div class="num">' + fmtDate(p.created_at) + '</div><div class="label">Member Since</div></div>' +
        '</div>' +
        '<hr style="border-color:var(--border);margin:1.5rem 0">' +
        '<form id="profile-form" autocomplete="off">' +
          '<div class="form-row"><div class="form-field"><label>First Name</label><input type="text" id="pf-fn" value="' + escHtml(p.first_name) + '" required></div>' +
          '<div class="form-field"><label>Last Name</label><input type="text" id="pf-ln" value="' + escHtml(p.last_name) + '" required></div></div>' +
          '<button type="submit" class="btn btn-primary">Update Profile</button>' +
        '</form>' +
        '<hr style="border-color:var(--border);margin:1.5rem 0">' +
        '<h3 style="color:#ef4444;margin-bottom:.5rem">Danger Zone</h3>' +
        '<p style="font-size:.85rem;color:var(--text-sec);margin-bottom:.8rem">Permanently delete your account and all associated data. This action cannot be undone.</p>' +
        '<button class="btn-danger-outline" id="btn-delete-account">Delete My Account</button>';

      $('#profile-form').addEventListener('submit', function(e) {
        e.preventDefault();
        showLoader();
        api('PUT', '/student/profile', { first_name: $('#pf-fn').value.trim(), last_name: $('#pf-ln').value.trim() })
    
        .then(function(d) {
          toast('Profile updated!', 'success');
          var newName = d.first_name + ' ' + d.last_name;
          sessionStorage.setItem('userName', newName);
          $('#topbar-username').textContent = newName;
          $('#user-avatar').textContent = d.first_name.charAt(0).toUpperCase();
        })
        .catch(function(err) { toast(err.message, 'error'); })
        .finally(hideLoader);
      });

      $('#btn-delete-account').addEventListener('click', function() {
        if (!confirm('Are you sure you want to delete your account? This CANNOT be undone!')) return;
        if (!confirm('Final confirmation: ALL your data (courses, progress, certificates) will be permanently deleted.')) return;
        showLoader();
        api('DELETE', '/student/account')
        .then(function() {
          sessionStorage.clear();
          window.location.href = 'student-login.html';
        })
        .catch(function(err) { toast(err.message, 'error'); hideLoader(); });
      });
    })
    .catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }


  /* ── Expose to inline onclick ────────────────── */
  window.studentApp = {
    enroll: enrollInCourse,
    openCourse: openCoursePlayer,
    playModule: playModuleById,
    markDone: markModuleDone,
    claimCert: claimCertificate,
  };


  /* ── Initial Load ───────────────────────────── */
  try {
    loadCatalog();
  } catch(e) {
    console.error('Init error:', e);
  }
  hideLoader();
  console.log('Student dashboard initialized');

})();
