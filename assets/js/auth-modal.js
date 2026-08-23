// THE UNITAS GLOBAL -- Rev 1 Secure Auth modal component.
//
// Owns the #auth-modal-overlay markup declared in index.html: Email OTP
// (doubles as Instant Signup, since Supabase auto-creates the user on first
// OTP request), a disabled SMS OTP tab scaffolded pending an SMS provider,
// and a password fallback for accounts created before Rev 1. index.html
// calls UnitasAuthModal.init() once its Supabase client exists; the global
// open/close/tab/submit functions below are what the modal's inline onclick
// attributes call.
(function () {
  'use strict';

  var client = null;
  var t = function (key) { return key; };
  var onAuthed = function () {};
  var passwordFallbackVisible = false;

  function el(id) { return document.getElementById(id); }

  function setMsg(text, isError) {
    var msgEl = el('auth-modal-msg');
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.color = isError ? '#ef4444' : '#22c55e';
  }

  function open() {
    var overlay = el('auth-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    setMsg('');
  }

  function close() {
    var overlay = el('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function switchTab(tab) {
    var emailTab = el('auth-tab-email');
    var smsTab = el('auth-tab-sms');
    var emailPanel = el('auth-panel-email');
    var smsPanel = el('auth-panel-sms');
    if (!emailTab || !smsTab || !emailPanel || !smsPanel) return;
    var isEmail = tab !== 'sms';
    emailTab.classList.toggle('active', isEmail);
    smsTab.classList.toggle('active', !isEmail);
    emailPanel.classList.toggle('hidden', !isEmail);
    smsPanel.classList.toggle('hidden', isEmail);
    setMsg('');
  }

  function togglePasswordFallback() {
    passwordFallbackVisible = !passwordFallbackVisible;
    var form = el('password-fallback-form');
    var toggleBtn = el('password-fallback-toggle');
    var tabRow = el('auth-tab-email') ? el('auth-tab-email').parentElement : null;
    var emailPanel = el('auth-panel-email');
    var smsPanel = el('auth-panel-sms');
    if (!form || !toggleBtn) return;

    form.classList.toggle('hidden', !passwordFallbackVisible);
    if (tabRow) tabRow.classList.toggle('hidden', passwordFallbackVisible);
    if (emailPanel) emailPanel.classList.toggle('hidden', passwordFallbackVisible);
    if (smsPanel) smsPanel.classList.add('hidden');
    if (!passwordFallbackVisible) switchTab('email');

    toggleBtn.textContent = passwordFallbackVisible ? t('link_use_otp') : t('link_use_password');
    setMsg('');
  }

  async function sendEmailOtp() {
    if (!client) { setMsg(t('alert_supabase_not_configured'), true); return; }
    var emailInput = el('otp-email');
    var email = (emailInput.value || '').trim();
    if (!email) return;
    var btn = el('send-otp-btn');
    if (btn) btn.disabled = true;
    try {
      var res = await client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
      if (res.error) throw res.error;
      el('otp-code-row').classList.remove('hidden');
      setMsg(t('otp_sent_notice'), false);
    } catch (error) {
      setMsg(t('otp_send_error_prefix') + error.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function verifyEmailOtp() {
    if (!client) { setMsg(t('alert_supabase_not_configured'), true); return; }
    var email = (el('otp-email').value || '').trim();
    var code = (el('otp-code').value || '').trim();
    if (!email || !code) return;
    var btn = el('verify-otp-btn');
    if (btn) btn.disabled = true;
    try {
      var res = await client.auth.verifyOtp({ email: email, token: code, type: 'email' });
      if (res.error) throw res.error;
      close();
      await onAuthed();
    } catch (error) {
      setMsg(t('otp_verify_error_prefix') + error.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handlePasswordSignIn(e) {
    e.preventDefault();
    if (!client) { setMsg(t('alert_supabase_not_configured'), true); return; }
    var email = el('pw-email').value;
    var password = el('pw-password').value;
    try {
      var res = await client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      close();
      await onAuthed();
    } catch (error) {
      setMsg(t('msg_auth_failed_prefix') + error.message, true);
    }
  }

  function init(supabaseClient, helpers) {
    client = supabaseClient;
    if (helpers && helpers.t) t = helpers.t;
    if (helpers && helpers.onAuthed) onAuthed = helpers.onAuthed;
  }

  window.UnitasAuthModal = { init: init };
  window.openAuthModal = open;
  window.closeAuthModal = close;
  window.switchAuthTab = switchTab;
  window.togglePasswordFallback = togglePasswordFallback;
  window.sendEmailOtp = sendEmailOtp;
  window.verifyEmailOtp = verifyEmailOtp;
  window.handlePasswordSignIn = handlePasswordSignIn;
})();
