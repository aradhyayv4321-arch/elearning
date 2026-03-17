/* ═══════════════════════════════════════════════
   LearnVault — Shared Auth Logic (connected to backend)
   ═══════════════════════════════════════════════ */

var API_BASE = window.location.port === '8001'
  ? 'http://127.0.0.1:8001'
  : window.location.origin;

function $(s) { return document.querySelector(s); }

function showLoader() { var el = $('#loader-overlay'); if (el) el.classList.remove('hidden'); }
function hideLoader() { var el = $('#loader-overlay'); if (el) el.classList.add('hidden'); }

function toast(msg, type) {
  type = type || 'info';
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  var container = $('#toast-container');
  if (container) { container.appendChild(el); setTimeout(function() { el.remove(); }, 3000); }
}

/* ── Real API calls ────────────────────────── */

function apiLogin(email, password, requiredRole) {
  var payload = { email: email, password: password };
  if (requiredRole) payload.required_role = requiredRole;
  return fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.detail || 'Login failed. Please try again.');
      return data;
    });
  }).catch(function(err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please make sure the backend is running.');
    }
    throw err;
  });
}

function apiRegister(firstName, lastName, email, password) {
  return fetch(API_BASE + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: email,
      password: password,
    }),
  }).then(function(res) {
    return res.json().then(function(data) {
      if (!res.ok) throw new Error(data.detail || 'Registration failed. Please try again.');
      return data;
    });
  }).catch(function(err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Unable to connect to the server. Please make sure the backend is running.');
    }
    throw err;
  });
}

/* ── Password Strength Validator ────────────── */

var BLOCKED_PASSWORDS = [
  'abc@1234', 'abcd@1234', 'abc@12345', 'password1!', 'password@1',
  'password@123', 'p@ssword1', 'p@ssw0rd1', 'qwerty@123',
  'welcome@1', 'welcome@123', 'admin@123', 'admin@1234',
  'test@1234', 'test@12345', 'letmein@1', 'changeme@1',
  '12345678a!', '1234abcd!', 'abcdefg@1', 'iloveyou1!',
  'sunshine@1', 'princess@1', 'football@1', 'monkey@123',
  'dragon@123', 'master@123', 'trustno1!', 'aa@12345678'
];

function validatePasswordStrength(password, firstName, lastName, email) {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 16) return 'Password must be at most 16 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter (A-Z).';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter (a-z).';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number (0-9).';
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?\/~`]/.test(password)) return 'Password must contain at least one special character (!@#$%^&* etc.).';

  var pwLower = password.toLowerCase();
  if (firstName && firstName.length >= 3 && pwLower.indexOf(firstName.toLowerCase()) !== -1)
    return 'Password must not contain your first name.';
  if (lastName && lastName.length >= 3 && pwLower.indexOf(lastName.toLowerCase()) !== -1)
    return 'Password must not contain your last name.';
  var emailLocal = email.split('@')[0].toLowerCase();
  if (emailLocal.length >= 3 && pwLower.indexOf(emailLocal) !== -1)
    return 'Password must not contain your email username.';

  if (BLOCKED_PASSWORDS.indexOf(pwLower) !== -1)
    return 'This password is too common and easy to guess. Please choose a stronger one.';

  return null;
}

/* ── Init — called from login pages ────────── */
function initAuth(config) {
  var loginForm = $('#login-form');
  var loginError = $('#login-error');

  // Sign In
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    showLoader();

    var email = $('#login-email').value.trim();
    var password = $('#login-password').value;

    if (!email || !password) {
      loginError.textContent = 'Please enter both email and password.';
      loginError.classList.remove('hidden');
      hideLoader();
      return;
    }

    apiLogin(email, password, config.requiredRole)
      .then(function(data) {
        sessionStorage.setItem('token', data.access_token);
        sessionStorage.setItem('userName', data.name);
        sessionStorage.setItem('userRole', data.role);
        window.location.href = config.dashboardUrl;
      })
      .catch(function(err) {
        loginError.textContent = err.message;
        loginError.classList.remove('hidden');
      })
      .finally(function() { hideLoader(); });
  });

  // Toggle Sign In / Sign Up (student only)
  var showRegister = $('#show-register');
  var showLogin = $('#show-login');
  var signinCard = $('#signin-card');
  var registerCard = $('#register-card');

  if (showRegister) {
    showRegister.addEventListener('click', function(e) {
      e.preventDefault();
      signinCard.classList.add('hidden');
      registerCard.classList.remove('hidden');
    });
  }

  if (showLogin) {
    showLogin.addEventListener('click', function(e) {
      e.preventDefault();
      registerCard.classList.add('hidden');
      signinCard.classList.remove('hidden');
    });
  }

  // Registration
  var registerForm = $('#register-form');
  if (registerForm) {
    var registerError = $('#register-error');

    // Live password strength meter
    var regPwInput = $('#reg-password');
    var pwFill = $('#pw-strength-fill');
    var pwLabel = $('#pw-strength-label');
    if (regPwInput && pwFill && pwLabel) {
      regPwInput.addEventListener('input', function() {
        var pw = regPwInput.value;
        var score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?\/~`]/.test(pw)) score++;

        pwFill.className = 'pw-strength-fill';
        pwLabel.className = 'pw-strength-label';
        if (pw.length === 0) { pwLabel.textContent = ''; }
        else if (score <= 1) { pwFill.classList.add('str-weak'); pwLabel.classList.add('str-weak'); pwLabel.textContent = 'Weak'; }
        else if (score <= 2) { pwFill.classList.add('str-fair'); pwLabel.classList.add('str-fair'); pwLabel.textContent = 'Fair'; }
        else if (score <= 3) { pwFill.classList.add('str-good'); pwLabel.classList.add('str-good'); pwLabel.textContent = 'Good'; }
        else { pwFill.classList.add('str-strong'); pwLabel.classList.add('str-strong'); pwLabel.textContent = 'Strong'; }
      });
    }

    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      registerError.classList.add('hidden');

      var firstName = $('#reg-first-name').value.trim();
      var lastName = $('#reg-last-name').value.trim();
      var email = $('#reg-email').value.trim();
      var password = $('#reg-password').value;
      var confirm = $('#reg-confirm-password').value;

      if (!firstName || !lastName || !email || !password) {
        registerError.textContent = 'All fields are required.';
        registerError.classList.remove('hidden');
        return;
      }

      // Password strength validation
      var pwErr = validatePasswordStrength(password, firstName, lastName, email);
      if (pwErr) {
        registerError.textContent = pwErr;
        registerError.classList.remove('hidden');
        return;
      }

      if (password !== confirm) {
        registerError.textContent = 'Passwords do not match.';
        registerError.classList.remove('hidden');
        return;
      }

      showLoader();
      apiRegister(firstName, lastName, email, password)
        .then(function(data) {
          sessionStorage.setItem('token', data.access_token);
          sessionStorage.setItem('userName', data.name);
          sessionStorage.setItem('userRole', data.role);
          window.location.href = config.dashboardUrl;
        })
        .catch(function(err) {
          registerError.textContent = err.message;
          registerError.classList.remove('hidden');
        })
        .finally(function() { hideLoader(); });
    });
  }

  hideLoader();
}
