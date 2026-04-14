import React, { useState, useEffect } from "react";

const API = "https://pa-genie-backend.onrender.com";

export default function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [callLog, setCallLog] = useState("");

  const [form, setForm] = useState({
    patient_name: "",
    payer_name: ""
  });

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  // 🔐 LOGIN
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.email && loginForm.password) {
      setUser(loginForm.email);
      localStorage.setItem("user", loginForm.email);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(saved);
  }, []);

  // 📡 FETCH CASES
  const fetchCases = () => {
    fetch(`${API}/pa-cases`)
      .then(res => res.json())
      .then(setCases);
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  // ➕ CREATE CASE
  const handleSubmit = (e) => {
    e.preventDefault();

    fetch(`${API}/pa-cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        visit_type: "IN_OFFICE",
        chart_note_text: "Created from UI"
      })
    }).then(fetchCases);
  };

  // 🤖 REAL AI CALL
  const runAISimulation = () => {
    fetch(`${API}/ai-call/${selectedCase.id}`, {
      method: "POST"
    })
      .then(res => res.json())
      .then((data) => {
        setCallLog(data.call_notes);
        fetchCases();
      })
      .catch(err => console.error(err));
  };

  // 🎨 STATUS COLORS
  const getStatusColor = (status) => {
    if (status === "APPROVED") return "#22c55e";
    if (status === "DENIED") return "#ef4444";
    return "#facc15";
  };

  // 🔐 LOGIN SCREEN
  if (!user) {
    return (
      <div style={styles.center}>
        <form onSubmit={handleLogin} style={styles.card}>
          <h2>PA Genie</h2>
          <input
            placeholder="Email"
            onChange={(e) =>
              setLoginForm({ ...loginForm, email: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) =>
              setLoginForm({ ...loginForm, password: e.target.value })
            }
          />
          <button>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2>PA Genie</h2>
        <p>Dashboard</p>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {/* CREATE */}
        <div style={styles.card}>
          <h3>Create Case</h3>
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Patient"
              onChange={(e) =>
                setForm({ ...form, patient_name: e.target.value })
              }
            />
            <input
              placeholder="Insurance"
              onChange={(e) =>
                setForm({ ...form, payer_name: e.target.value })
              }
            />
            <button>Create</button>
          </form>
        </div>

        {/* CASE LIST */}
        <div style={styles.card}>
          <h3>Cases</h3>
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCase(c)}
              style={styles.caseItem}
            >
              <strong>{c.patient_name}</strong>
              <div style={{ color: getStatusColor(c.submission_status) }}>
                {c.submission_status}
              </div>
            </div>
          ))}
        </div>

        {/* DETAIL */}
        {selectedCase && (
          <div style={styles.card}>
            <h3>{selectedCase.patient_name}</h3>

            <button onClick={runAISimulation}>
              🤖 Run AI Call
            </button>

            {callLog && (
              <pre style={styles.log}>
                {callLog}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 🎨 STYLES
const styles = {
  layout: { display: "flex", height: "100vh", fontFamily: "sans-serif" },
  sidebar: { width: 200, background: "#0f172a", color: "white", padding: 20 },
  main: { flex: 1, padding: 20, background: "#f8fafc" },
  card: { background: "white", padding: 20, borderRadius: 10, marginBottom: 20 },
  caseItem: {
    padding: 10,
    marginBottom: 8,
    background: "#f1f5f9",
    borderRadius: 8,
    cursor: "pointer"
  },
  center: {
    display: "flex",
    height: "100vh",
    alignItems: "center",
    justifyContent: "center"
  },
  log: {
    marginTop: 15,
    background: "#0f172a",
    color: "lime",
    padding: 10,
    whiteSpace: "pre-wrap"
  }
};