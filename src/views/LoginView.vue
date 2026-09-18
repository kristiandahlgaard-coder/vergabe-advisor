<template>
  <div class="login-wrapper">
    <div class="login-container">
      <div class="login-header">
        <h1>Vergabe Advisor</h1>
        <p>Prokurationsplattform für öffentliche Auftraggeber</p>
      </div>

      <form @submit.prevent="login" class="login-form">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="kristian@example.com">
        </div>

        <div class="form-group">
          <label>Passwort</label>
          <input v-model="password" type="password" required placeholder="test123">
        </div>

        <button type="submit" class="btn-login">Login</button>

        <div v-if="error" class="error-message">{{ error }}</div>
      </form>

      <div class="login-hint">
        <p><strong>Test-Benutzer:</strong></p>
        <p>Email: kristian@example.com</p>
        <p>Passwort: test123</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginView',
  data() {
    return {
      email: '',
      password: '',
      error: ''
    };
  },
  methods: {
    async login() {
      try {
        const res = await fetch('https://vergabe-advisor-production.up.railway.app/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email, password: this.password })
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.setItem('token', data.token);
          this.$router.push('/advisor');
        } else {
          this.error = data.error || 'Login fehlgeschlagen';
        }
      } catch (err) {
        this.error = 'Verbindungsfehler';
      }
    }
  }
};
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  padding: 40px 20px;
}

.login-container {
  width: 100%;
  max-width: 480px;
}

.login-header {
  text-align: center;
  margin-bottom: 60px;
}

.login-header h1 {
  font-size: 42px;
  font-weight: 600;
  margin-bottom: 12px;
  letter-spacing: -1px;
}

.login-header p {
  font-size: 16px;
  color: #666;
  font-weight: 400;
}

.login-form {
  margin-bottom: 40px;
}

.form-group {
  margin-bottom: 24px;
}

label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  color: #1a1a1a;
}

input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #ddd;
  border-radius: 2px;
  font-size: 14px;
  transition: border 0.2s;
}

input:focus {
  outline: none;
  border-color: #1a1a1a;
}

.btn-login {
  width: 100%;
  padding: 16px;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-login:hover {
  background: #333;
}

.error-message {
  color: #d32f2f;
  font-size: 13px;
  margin-top: 16px;
  text-align: center;
}

.login-hint {
  background: #f5f5f5;
  padding: 24px;
  border-radius: 2px;
  font-size: 13px;
  line-height: 1.8;
}

.login-hint p {
  margin: 0;
}

.login-hint p:first-child {
  font-weight: 600;
  margin-bottom: 8px;
}
</style>
