/* ═══════════════════════════════════════════════
   LearnVault — Admin Dashboard JS (Optimised)
   ═══════════════════════════════════════════════ */
;(function () {
  'use strict';

  var $ = function(s) { return document.querySelector(s); };
  var $$ = function(s) { return document.querySelectorAll(s); };

  /* ── Session check ─────────────────────────── */
  var token = sessionStorage.getItem('token');
  var userName = sessionStorage.getItem('userName') || 'Admin';
  if (!token) { window.location.href = 'admin-login.html'; return; }

  $('#topbar-username').textContent = userName;
  $('#user-avatar').textContent = userName.charAt(0).toUpperCase();

  /* ── Helpers ───────────────────────────────── */
  var loader = $('#loader-overlay');
  function showLoader() { loader.classList.remove('hidden'); }
  function hideLoader() { loader.classList.add('hidden'); }

  function toast(msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toast-container').appendChild(el);
    setTimeout(function() { el.remove(); }, 3500);
  }

  /* ── Optimised API helper ──────────────────── */
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
        window.location.href = 'admin-login.html';
        throw new Error('Session expired');
      }
      return res.json().then(function(data) {
        if (!res.ok) throw new Error(data.detail || 'Request failed');
        return data;
      });
    });
  }

  /* Raw fetch for non-JSON responses (exports etc) */
  function apiRaw(method, path) {
    var sep = path.indexOf('?') !== -1 ? '&' : '?';
    return fetch(path + sep + 'token=' + token, { method: method });
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escAttr(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Sidebar Navigation ────────────────────── */
  var sidebar = $('#sidebar');
  function closeSidebar() {
    sidebar.classList.remove('open');
    var bd = $('.sidebar-backdrop');
    if (bd) bd.remove();
  }
  $('#sidebar-toggle').addEventListener('click', function() {
    var isOpen = sidebar.classList.toggle('open');
    if (isOpen) {
      var bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      bd.addEventListener('click', closeSidebar);
      document.body.appendChild(bd);
    } else { closeSidebar(); }
  });

  /* ── Active view tracking + auto-poll ────── */
  var activeView = 'courses';
  var pollTimer = null;
  var POLL_INTERVAL = 30000; // 30 seconds
  var isPollRefresh = false;

  function refreshActiveView() {
    // Skip poll if modal is open
    if ($('#modal-root').innerHTML) return;
    isPollRefresh = true;
    if (activeView === 'courses') loadCourses();
    else if (activeView === 'progress') loadProgress();
    else if (activeView === 'students') loadStudents();
    else if (activeView === 'tokens') loadTokens();
  }

  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(refreshActiveView, POLL_INTERVAL);
  }
  startPoll();

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
      activeView = btn.getAttribute('data-view');
      refreshActiveView();
      startPoll();
    });
  });

  /* ── Logout ────────────────────────────────── */
  $('#logout-btn').addEventListener('click', function() {
    api('POST', '/auth/logout').catch(function(){});
    sessionStorage.clear();
    window.location.href = 'admin-login.html';
  });

  /* ── Modal helper ──────────────────────────── */
  function openModal(title, contentHtml, onMount) {
    var root = $('#modal-root');
    root.innerHTML = '<div class="modal-overlay" id="modal-overlay"><div class="modal-box"><button class="modal-close" id="modal-close-btn">&times;</button><h2>' + escHtml(title) + '</h2><div id="modal-body">' + contentHtml + '</div></div></div>';
    $('#modal-close-btn').addEventListener('click', closeModal);
    $('#modal-overlay').addEventListener('click', function(e) { if (e.target.id === 'modal-overlay') closeModal(); });
    if (onMount) setTimeout(onMount, 10);
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }


  /* ═══════════════════════════════════════════════
     COURSES
     ═══════════════════════════════════════════════ */

  var coursesCache = [];
  var testsCache = [];

  function loadCourses(silent) {
    if (!silent) showLoader();
    api('GET', '/admin/courses').then(function(courses) {
      coursesCache = courses;
      return api('GET', '/admin/tests');
    }).then(function(tests) {
      testsCache = tests;
      renderCourses();
    }).catch(function(err) {
      if (!isPollRefresh) toast('Failed to load courses: ' + err.message, 'error');
      else console.warn('Poll refresh error:', err.message);
    }).finally(function() { isPollRefresh = false; if (!silent) hideLoader(); });
  }

  function renderCourses() {
    var tbody = $('#courses-tbody');
    var empty = $('#courses-empty');
    var stats = $('#course-stats');

    var totalModules = 0, totalTests = testsCache.length;
    stats.innerHTML = '<div class="stat-card"><div class="stat-num">' + coursesCache.length + '</div><div class="stat-label">Courses</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + totalTests + '</div><div class="stat-label">Tests</div></div>';

    if (coursesCache.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = coursesCache.map(function(c) {
      var cTests = testsCache.filter(function(t) { return t.course_id === c.id; });
      return '<tr>' +
        '<td><strong>' + escHtml(c.name) + '</strong><br><small style="color:var(--text-sec)">' + escHtml(c.description).substring(0, 60) + '</small></td>' +
        '<td><span class="course-badge">' + escHtml(c.category) + '</span></td>' +
        '<td>' + escHtml(c.author) + '</td>' +
        '<td><button class="btn btn-secondary" style="font-size:.78rem;padding:.3rem .7rem" onclick="adminApp.manageModules(' + c.id + ')">+ Add Content</button></td>' +
        '<td>' + cTests.length + ' <button class="btn btn-secondary" style="font-size:.78rem;padding:.3rem .7rem" onclick="adminApp.manageTests(' + c.id + ')">+ Add Test</button></td>' +
        '<td><span class="cell-text muted">' + fmtDate(c.created_at) + '</span></td>' +
        '<td><div class="btn-group"><button class="action-btn" onclick="adminApp.editCourse(' + c.id + ')">Edit</button><button class="action-btn danger" onclick="adminApp.deleteCourse(' + c.id + ')">Delete</button></div></td>' +
        '</tr>';
    }).join('');
  }

  // New Course
  $('#btn-new-course').addEventListener('click', function() {
    var html = '<form id="modal-course-form" autocomplete="off">' +
      '<div class="form-row"><div class="form-field"><label>Course Name</label><input type="text" id="mc-name" required /></div><div class="form-field"><label>Category</label><select id="mc-cat" required><option value="">Select…</option><option value="programming">Programming</option><option value="data-science">Data Science</option><option value="design">Design</option><option value="business">Business</option><option value="security">Security</option></select></div></div>' +
      '<div class="form-field"><label>Author</label><input type="text" id="mc-author" value="LearnVault" /></div>' +
      '<div class="form-field"><label>Description</label><textarea id="mc-desc" rows="3" required></textarea></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Create Course</button></form>';
    openModal('New Course', html, function() {
      $('#modal-course-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var data = { name: $('#mc-name').value.trim(), category: $('#mc-cat').value, description: $('#mc-desc').value.trim(), author: $('#mc-author').value.trim() || 'LearnVault' };
        showLoader();
        api('POST', '/admin/course/', data).then(function() {
          toast('Course created!', 'success'); closeModal(); loadCourses();
        }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
      });
    });
  });

  function editCourse(id) {
    var c = coursesCache.find(function(x) { return x.id === id; });
    if (!c) return;
    var html = '<form id="modal-edit-form" autocomplete="off">' +
      '<div class="form-field"><label>Name</label><input type="text" id="me-name" value="' + escAttr(c.name) + '" /></div>' +
      '<div class="form-field"><label>Category</label><input type="text" id="me-cat" value="' + escAttr(c.category) + '" /></div>' +
      '<div class="form-field"><label>Author</label><input type="text" id="me-author" value="' + escAttr(c.author) + '" /></div>' +
      '<div class="form-field"><label>Description</label><textarea id="me-desc" rows="3">' + escHtml(c.description) + '</textarea></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Save Changes</button></form>';
    openModal('Edit Course', html, function() {
      $('#modal-edit-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var data = { name: $('#me-name').value.trim(), category: $('#me-cat').value.trim(), description: $('#me-desc').value.trim(), author: $('#me-author').value.trim() };
        showLoader();
        api('PUT', '/admin/course/' + id, data).then(function() {
          toast('Course updated!', 'success'); closeModal(); loadCourses();
        }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
      });
    });
  }

  function deleteCourse(id) {
    if (!confirm('Delete this course? All modules and tests will be removed.')) return;
    showLoader();
    api('DELETE', '/admin/course/' + id).then(function() {
      toast('Course deleted', 'success'); loadCourses();
    }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
  }

  /* ── Modules management modal ── */
  function manageModules(courseId) {
    showLoader();
    api('GET', '/admin/course/' + courseId + '/modules').then(function(data) {
      hideLoader();
      var modules = data.modules || [];
      var html = '<div id="mod-list">' + renderModuleList(modules, courseId) + '</div>' +
        '<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>' +
        '<h3 style="font-size:.95rem;margin-bottom:.75rem">Add Module</h3>' +
        '<form id="modal-add-mod" autocomplete="off">' +
        '<div class="form-row"><div class="form-field"><label>Title</label><input type="text" id="mm-title" required /></div><div class="form-field"><label>Type</label><select id="mm-type"><option value="video">Video</option><option value="text">Text</option></select></div></div>' +
        '<div class="form-field"><label>URL (optional)</label><input type="text" id="mm-url" placeholder="https://..." /></div>' +
        '<div class="form-field"><label>Upload File</label><div class="file-upload-area" id="mm-drop"><input type="file" id="mm-file" /><span>Click to upload video or document</span></div></div>' +
        '<div class="form-field"><label>Order</label><input type="number" id="mm-order" value="' + (modules.length + 1) + '" min="0" /></div>' +
        '<button type="submit" class="btn btn-primary btn-full">Add Module</button></form>';
      openModal('Modules — ' + (data.course ? data.course.name : ''), html, function() {
        $('#mm-drop').addEventListener('click', function() { $('#mm-file').click(); });
        $('#modal-add-mod').addEventListener('submit', function(e) {
          e.preventDefault();
          var modData = { course_id: courseId, title: $('#mm-title').value.trim(), content_type: $('#mm-type').value, url: $('#mm-url').value.trim() || null, order: parseInt($('#mm-order').value) || 0 };
          showLoader();
          api('POST', '/admin/module/', modData).then(function(mod) {
            var fileInput = $('#mm-file');
            if (fileInput && fileInput.files.length > 0) {
              var fd = new FormData();
              fd.append('file', fileInput.files[0]);
              return fetch('/admin/upload?module_id=' + mod.id + '&token=' + token, { method: 'POST', body: fd }).then(function() { return mod; });
            }
            return mod;
          }).then(function() {
            toast('Module added!', 'success'); closeModal(); manageModules(courseId);
          }).catch(function(err) { toast('Error: ' + err.message, 'error'); })
          .finally(hideLoader);
        });
      });
    }).catch(function(err) { hideLoader(); toast('Error: ' + err.message, 'error'); });
  }

  function renderModuleList(modules, courseId) {
    if (modules.length === 0) return '<p class="empty-state">No modules yet.</p>';
    return '<table class="data-table"><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Actions</th></tr></thead><tbody>' +
      modules.map(function(m) {
        return '<tr><td>' + m.order + '</td><td>' + escHtml(m.title) + '</td><td><span class="tag tag-' + m.content_type + '">' + m.content_type + '</span></td>' +
          '<td><button class="action-btn danger" onclick="adminApp.deleteModule(' + m.id + ',' + courseId + ')">Delete</button></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function deleteModule(moduleId, courseId) {
    if (!confirm('Delete this module?')) return;
    showLoader();
    api('DELETE', '/admin/module/' + moduleId).then(function() {
      toast('Module deleted', 'success'); closeModal(); manageModules(courseId);
    }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
  }

  /* ── Tests management modal ── */
  function manageTests(courseId) {
    showLoader();
    api('GET', '/admin/tests').then(function(allTests) {
      hideLoader();
      var tests = allTests.filter(function(t) { return t.course_id === courseId; });
      var html = '<div id="test-list">' + renderTestList(tests) + '</div>' +
        '<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>' +
        '<h3 style="font-size:.95rem;margin-bottom:.75rem">Create Test</h3>' +
        '<form id="modal-add-test" autocomplete="off">' +
        '<div class="form-row"><div class="form-field"><label>Test Title</label><input type="text" id="mt-title" required /></div>' +
        '<div class="form-field"><label>Time (minutes)</label><input type="number" id="mt-time" value="30" min="1" max="300" required /></div></div>' +
        '<button type="submit" class="btn btn-primary btn-full">Create Test</button></form>';
      var cName = coursesCache.find(function(c) { return c.id === courseId; });
      openModal('Tests — ' + (cName ? cName.name : ''), html, function() {
        $('#modal-add-test').addEventListener('submit', function(e) {
          e.preventDefault();
          showLoader();
          api('POST', '/admin/test/', { course_id: courseId, title: $('#mt-title').value.trim(), time_limit_minutes: parseInt($('#mt-time').value) }).then(function() {
            toast('Test created!', 'success'); closeModal(); manageTests(courseId); loadCourses();
          }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
        });
      });
    }).catch(function(err) { hideLoader(); toast('Error: ' + err.message, 'error'); });
  }

  function renderTestList(tests) {
    if (tests.length === 0) return '<p class="empty-state">No tests yet.</p>';
    return '<table class="data-table"><thead><tr><th>Title</th><th>Time</th><th>Questions</th><th>Actions</th></tr></thead><tbody>' +
      tests.map(function(t) {
        return '<tr><td>' + escHtml(t.title) + '</td><td>' + t.time_limit_minutes + ' min</td><td>' + t.question_count + '</td>' +
          '<td><div class="btn-group"><button class="action-btn" onclick="adminApp.addQuestion(' + t.id + ',' + t.course_id + ')">+ Question</button>' +
          '<button class="action-btn danger" onclick="adminApp.deleteTest(' + t.id + ',' + t.course_id + ')">Delete</button></div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function addQuestion(testId, courseId) {
    var qCount = 0;
    function makeQRow(idx) {
      return '<div class="q-row" data-qi="' + idx + '" style="border:1px solid var(--border);border-radius:var(--r-md);padding:1rem;margin-bottom:.8rem;background:var(--bg)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><strong style="font-size:.85rem">Question ' + (idx + 1) + '</strong>' +
        (idx > 0 ? '<button type="button" class="action-btn danger" onclick="this.closest(\'.q-row\').remove()">Remove</button>' : '') + '</div>' +
        '<div class="form-field"><textarea placeholder="Enter question..." class="bq-q" rows="2" required></textarea></div>' +
        '<div class="form-row"><div class="form-field"><label>A</label><input type="text" class="bq-a" required /></div><div class="form-field"><label>B</label><input type="text" class="bq-b" required /></div></div>' +
        '<div class="form-row"><div class="form-field"><label>C</label><input type="text" class="bq-c" /></div><div class="form-field"><label>D</label><input type="text" class="bq-d" /></div></div>' +
        '<div class="form-row"><div class="form-field"><label>Correct</label><select class="bq-correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div>' +
        '<div class="form-field"><label>Marks</label><input type="number" class="bq-marks" value="1" min="1" /></div></div></div>';
    }

    var html = '<form id="modal-batch-q" autocomplete="off">' +
      '<div id="bq-container">' + makeQRow(0) + '</div>' +
      '<button type="button" id="bq-add-more" class="btn btn-secondary btn-full" style="margin-bottom:1rem">+ Add Another Question</button>' +
      '<div id="bq-status" style="text-align:center;font-size:.85rem;color:var(--text-sec);margin-bottom:.5rem">1 question ready</div>' +
      '<button type="submit" class="btn btn-primary btn-full">Submit All Questions</button></form>';
    qCount = 1;

    openModal('Add MCQ Questions (Batch)', html, function() {
      $('#bq-add-more').addEventListener('click', function() {
        var container = $('#bq-container');
        container.insertAdjacentHTML('beforeend', makeQRow(qCount));
        qCount++;
        $('#bq-status').textContent = container.querySelectorAll('.q-row').length + ' questions ready';
        // Scroll to new question
        var rows = container.querySelectorAll('.q-row');
        rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      $('#modal-batch-q').addEventListener('submit', function(e) {
        e.preventDefault();
        var rows = document.querySelectorAll('#bq-container .q-row');
        var questions = [];
        var valid = true;
        rows.forEach(function(row) {
          var q = row.querySelector('.bq-q').value.trim();
          var a = row.querySelector('.bq-a').value.trim();
          var b = row.querySelector('.bq-b').value.trim();
          if (!q || !a || !b) { valid = false; return; }
          questions.push({
            question_type: 'mcq', question: q,
            option_a: a, option_b: b,
            option_c: row.querySelector('.bq-c').value.trim() || null,
            option_d: row.querySelector('.bq-d').value.trim() || null,
            correct_option: parseInt(row.querySelector('.bq-correct').value),
            marks: parseInt(row.querySelector('.bq-marks').value) || 1
          });
        });
        if (!valid || questions.length === 0) { toast('Fill in all required fields (Question, Option A, Option B)', 'error'); return; }

        showLoader();
        var done = 0;
        var errors = 0;
        // Submit sequentially
        function submitNext() {
          if (done >= questions.length) {
            hideLoader();
            toast(done - errors + ' of ' + questions.length + ' questions added!', errors > 0 ? 'error' : 'success');
            closeModal(); manageTests(courseId);
            return;
          }
          api('POST', '/admin/test/' + testId + '/question', questions[done]).then(function() {
            done++; submitNext();
          }).catch(function(err) {
            errors++; done++;
            toast('Q' + done + ' failed: ' + err.message, 'error');
            submitNext();
          });
        }
        submitNext();
      });
    });
  }

  function deleteTest(testId, courseId) {
    if (!confirm('Delete this test and all its questions?')) return;
    showLoader();
    api('DELETE', '/admin/test/' + testId).then(function() {
      toast('Test deleted', 'success'); closeModal(); manageTests(courseId); loadCourses();
    }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
  }


  /* ═══════════════════════════════════════════════
     STUDENT PROGRESS
     ═══════════════════════════════════════════════ */

  function loadProgress() {
    if (!isPollRefresh) showLoader();
    api('GET', '/admin/progress').then(function(data) {
      var list = $('#progress-list');
      var empty = $('#progress-empty');
      if (!data || data.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');
      list.innerHTML = data.map(function(s) {
        return '<div class="card" style="margin-bottom:1rem">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">' +
          '<div><strong>' + escHtml(s.student_name) + '</strong><br><small style="color:var(--text-sec)">' + escHtml(s.email) + '</small></div>' +
          '<button class="btn btn-secondary" onclick="adminApp.alertStudent(' + s.student_id + ',\'' + escAttr(s.student_name) + '\')">&#9993; Send Alert</button></div>' +
          s.courses.map(function(c) {
            return '<div style="margin-bottom:.75rem;padding:.75rem;background:var(--bg);border-radius:var(--r-sm)">' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:.35rem"><span style="font-weight:600;font-size:.88rem">' + escHtml(c.course_name) + '</span>' +
              '<span style="font-size:.82rem;color:var(--text-sec)">' + c.completed_modules + '/' + c.total_modules + ' modules</span></div>' +
              '<div class="progress-bar"><div class="progress-fill" style="width:' + c.completion_pct + '%"></div></div>' +
              '<div style="display:flex;justify-content:space-between;margin-top:.3rem;font-size:.78rem;color:var(--text-sec)"><span>' + c.completion_pct + '% complete</span>' +
              (c.best_score !== null ? '<span>Best score: <strong style="color:var(--text)">' + c.best_score + '%</strong></span>' : '') + '</div></div>';
          }).join('') + '</div>';
      }).join('');
    }).catch(function(err) {
      if (!isPollRefresh) toast('Error: ' + err.message, 'error');
    }).finally(function() { var wasPoll = isPollRefresh; isPollRefresh = false; if (!wasPoll) hideLoader(); });
  }

  function alertStudent(studentId, studentName) {
    var html = '<form id="modal-alert-form" autocomplete="off">' +
      '<div class="form-field"><label>Subject</label><input type="text" id="ma-subj" required /></div>' +
      '<div class="form-field"><label>Message</label><textarea id="ma-body" rows="3" required></textarea></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Send Message</button></form>';
    openModal('Alert — ' + studentName, html, function() {
      $('#modal-alert-form').addEventListener('submit', function(e) {
        e.preventDefault();
        showLoader();
        api('POST', '/admin/alert/' + studentId, { subject: $('#ma-subj').value.trim(), body: $('#ma-body').value.trim() }).then(function() {
          toast('Message sent!', 'success'); closeModal();
        }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
      });
    });
  }


  /* ═══════════════════════════════════════════════
     STUDENTS
     ═══════════════════════════════════════════════ */

  function loadStudents() {
    if (!isPollRefresh) showLoader();
    api('GET', '/admin/students').then(function(students) {
      var tbody = $('#students-tbody');
      var empty = $('#students-empty');
      var stats = $('#student-stats');

      stats.innerHTML = '<div class="stat-card"><div class="stat-num">' + students.length + '</div><div class="stat-label">Total Students</div></div>';

      if (students.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');
      tbody.innerHTML = students.map(function(s) {
        return '<tr>' +
          '<td><strong>' + escHtml(s.first_name + ' ' + s.last_name) + '</strong><br><small style="color:var(--text-sec)">' + escHtml(s.email) + '</small></td>' +
          '<td>' + fmtDate(s.start_date) + '</td>' +
          '<td>' + fmtDate(s.end_date) + '</td>' +
          '<td>' + fmtDate(s.created_at) + '</td>' +
          '<td><div class="btn-group">' +
          '<button class="action-btn" onclick="adminApp.editStudent(' + s.id + ')">Edit</button>' +
          '<button class="action-btn danger" onclick="adminApp.deleteStudent(' + s.id + ')">Delete</button>' +
          '</div></td></tr>';
      }).join('');
    }).catch(function(err) {
      if (!isPollRefresh) toast('Error: ' + err.message, 'error');
    }).finally(function() { var wasPoll = isPollRefresh; isPollRefresh = false; if (!wasPoll) hideLoader(); });
  }

  function editStudent(id) {
    var html = '<form id="modal-edit-student" autocomplete="off">' +
      '<div class="form-row"><div class="form-field"><label>Start Date</label><input type="date" id="ms-start" /></div>' +
      '<div class="form-field"><label>End Date</label><input type="date" id="ms-end" /></div></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Save</button></form>';
    openModal('Edit Student Dates', html, function() {
      $('#modal-edit-student').addEventListener('submit', function(e) {
        e.preventDefault();
        showLoader();
        api('PUT', '/admin/student/' + id, { start_date: $('#ms-start').value || null, end_date: $('#ms-end').value || null }).then(function() {
          toast('Student updated!', 'success'); closeModal(); loadStudents();
        }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
      });
    });
  }

  function deleteStudent(id) {
    if (!confirm('Delete this student? All their data will be removed permanently.')) return;
    showLoader();
    api('DELETE', '/admin/student/' + id).then(function() {
      toast('Student removed', 'success'); loadStudents();
    }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
  }


  /* ═══════════════════════════════════════════════
     SUPPORT TOKENS
     ═══════════════════════════════════════════════ */

  function loadTokens() {
    showLoader();
    api('GET', '/admin/tokens').then(function(tickets) {
      var list = $('#tokens-list');
      var empty = $('#tokens-empty');
      if (!tickets.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
      empty.classList.add('hidden');
      list.innerHTML = tickets.map(function(t) {
        return '<div class="card" style="margin-bottom:1rem">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div><strong>' + escHtml(t.subject) + '</strong><br><small style="color:var(--text-sec)">' + escHtml(t.student_name) + ' — ' + escHtml(t.student_email) + '</small><p style="margin:.5rem 0">' + escHtml(t.body) + '</p>' +
          (t.admin_reply ? '<div style="background:var(--bg);padding:.6rem;border-radius:var(--r-sm);font-size:.88rem"><strong>Your reply:</strong> ' + escHtml(t.admin_reply) + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;min-width:100px"><span class="tag tag-' + t.status + '">' + t.status + '</span><br><small style="color:var(--text-sec)">' + fmtDate(t.created_at) + '</small>' +
          (t.status !== 'closed' ? '<br><button class="action-btn" style="margin-top:.5rem" onclick="adminApp.replyToken(' + t.id + ')">Reply</button>' : '') +
          '</div></div></div>';
      }).join('');
    }).catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  function replyToken(id) {
    var html = '<form id="modal-reply-form" autocomplete="off">' +
      '<div class="form-field"><label>Reply</label><textarea id="mr-reply" rows="3" required></textarea></div>' +
      '<div class="form-field"><label>Status</label><select id="mr-status"><option value="in_progress">In Progress</option><option value="closed">Closed</option></select></div>' +
      '<button type="submit" class="btn btn-primary btn-full">Send Reply</button></form>';
    openModal('Reply to Ticket', html, function() {
      $('#modal-reply-form').addEventListener('submit', function(e) {
        e.preventDefault();
        showLoader();
        api('PUT', '/admin/token/' + id, { admin_reply: $('#mr-reply').value.trim(), status: $('#mr-status').value }).then(function() {
          toast('Reply sent!', 'success'); closeModal(); loadTokens();
        }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
      });
    });
  }


  /* ═══════════════════════════════════════════════
     ADMIN PROFILE
     ═══════════════════════════════════════════════ */

  function loadProfile() {
    showLoader();
    api('GET', '/admin/profile').then(function(p) {
      $('#prof-first').value = p.first_name;
      $('#prof-last').value = p.last_name;
      $('#prof-email').value = p.email;
    }).catch(function(err) { toast('Error: ' + err.message, 'error'); })
    .finally(hideLoader);
  }

  /* ── Export buttons ── */
  var exportBtns = $$('[data-export]');
  exportBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = btn.getAttribute('data-export');
      showLoader();
      apiRaw('GET', '/admin/export/' + type).then(function(r) {
        if (r.ok) return r.blob();
        throw new Error('Export failed');
      }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'learnvault-' + type + '.xlsx'; a.click();
        URL.revokeObjectURL(url);
        toast('Downloaded!', 'success');
      }).catch(function(err) { toast(err.message, 'error'); }).finally(hideLoader);
    });
  });

  /* ── Profile Form ── */
  $('#profile-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var msg = $('#profile-msg');
    msg.classList.add('hidden');
    var data = { first_name: $('#prof-first').value.trim(), last_name: $('#prof-last').value.trim() };
    if ($('#prof-new-pw').value) {
      data.current_password = $('#prof-cur-pw').value;
      data.new_password = $('#prof-new-pw').value;
    }
    showLoader();
    api('PUT', '/admin/profile', data).then(function(d) {
      toast('Profile updated!', 'success');
      var newName = (d.first_name || '') + ' ' + (d.last_name || '');
      sessionStorage.setItem('userName', newName.trim());
      $('#topbar-username').textContent = newName.trim();
      $('#user-avatar').textContent = newName.charAt(0).toUpperCase();
      $('#prof-cur-pw').value = '';
      $('#prof-new-pw').value = '';
    }).catch(function(err) { msg.textContent = err.message; msg.classList.remove('hidden'); })
    .finally(hideLoader);
  });


  /* ═══════════════════════════════════════════════
     Public API (for inline onclick handlers)
     ═══════════════════════════════════════════════ */
  window.adminApp = {
    editCourse: editCourse,
    deleteCourse: deleteCourse,
    manageModules: manageModules,
    deleteModule: deleteModule,
    manageTests: manageTests,
    addQuestion: addQuestion,
    deleteTest: deleteTest,
    alertStudent: alertStudent,
    editStudent: editStudent,
    deleteStudent: deleteStudent,
    replyToken: replyToken,
  };


  /* ── Initial Load ───────────────────────────── */
  try {
    loadCourses();
  } catch(e) {
    console.error('Init error:', e);
    toast('Failed to initialize: ' + e.message, 'error');
  }
  hideLoader();

  /* ── Cleanup on page unload ── */
  window.addEventListener('beforeunload', function() {
    if (pollTimer) clearInterval(pollTimer);
  });

})();
