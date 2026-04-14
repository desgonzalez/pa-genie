import React, { useState, useEffect } from "react";

const API = "https://pa-genie-backend.onrender.com";

export default function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [callLog, setCallLog] = useState("");

  const [form, setForm] = useState({
    patient_name: "",
    payer_name: "",
    cpt_codes: "",
    icd10_codes: ""
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(saved);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.email && loginForm.password) {
      setUser(loginForm.email);
      localStorage.setItem("user", loginForm.email);
    }
  };

  const fetchCases = () => {
    fetch(`${API}/pa-cases`)
      .then((res) => res.json())
      .then(setCases);
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

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
    }).then(() => {
      fetchCases();
      setForm({
        patient_name: "",
        payer_name: "",
        cpt_codes: "",
        icd10_codes: ""
      });
    });
  };

  const runAISimulation = () => {
    fetch(`${API}/ai-call/${selectedCase.id}`, {
      method: "POST"
    })
      .then((res) => res.json())
      .then((data) => {
        setCallLog(data.call_notes);
        fetchCases();
      });
  };

  if (!user) {
    return (
      <div style={styles.center}>
        <form onSubmit={handleLogin} style={styles.card}>
          <h2>PA Genie Login</h2>
          <input
            placeholder="Email"
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <h2>PA Genie</h2>
        <p>Dashboard</p>
      </div>

      <div style={styles.main}>
        <div style={styles.card}>
          <h3>Create Case</h3>
          <form onSubmit={handleSubmit}>
            <input
              placeholder="Patient Name"
              value={form.patient_name}
              onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
            />
            <input
              placeholder="Insurance"
              value={form.payer_name}
              onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
            />
            <input
              placeholder="CPT Codes"
              value={form.cpt_codes}
              onChange={(e) => setForm({ ...form, cpt_codes: e.target.value })}
            />
            <input
              placeholder="ICD10 Codes"
              value={form.icd10_codes}
              onChange={(e) => setForm({ ...form, icd10_codes: e.target.value })}
            />
            <button>Create</button>
          </form>
        </div>

        <div style={styles.card}>
          <h3>Cases</h3>
          {cases.map((c) => (
            <div
              key={c.id}
              style={styles.caseItem}
              onClick={() => {
                setSelectedCase(c);
                setCallLog(c.call_notes || "");
              }}
            >
              <strong>{c.patient_name}</strong>
              <div>{c.payer_name}</div>
            </div>
          ))}
        </div>

        {selectedCase && (
          <div style={styles.card}>
            <h2>{selectedCase.patient_name}</h2>
            <button onClick={runAISimulation}>🤖 Run AI Call</button>

            {callLog && (
              <div style={styles.timelineCard}>
                <h3>Case Timeline</h3>

                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}></div>
                  <div>
                    <strong>Case Created</strong>
                    <div>{selectedCase.patient_name}</div>
                  </div>
                </div>

                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}></div>
                  <div>
                    <strong>AI Insurance Call Completed</strong>
                    <pre style={styles.log}>{callLog}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc"
  },
  sidebar: {
    width: 220,
    background: "#0f172a",
    color: "white",
    padding: 20
  },
  main: {
    flex: 1,
    padding: 24
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  },
  caseItem: {
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    marginBottom: 10,
    cursor: "pointer"
  },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#f1f5f9"
  },
  timelineCard: {
    marginTop: 20,
    background: "white",
    borderRadius: 12,
    padding: 20,
    border: "1px solid #e2e8f0"
  },
  timelineItem: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    alignItems: "flex-start"
  },
  timelineDot: {
    width: 12,
    height: 12,
    background: "#2563eb",
    borderRadius: "50%",
    marginTop: 6
  },
  log: {
    marginTop: 10,
    background: "#0f172a",
    color: "#86efac",
    padding: 12,
    borderRadius: 8,
    whiteSpace: "pre-wrap",
    fontSize: 14
  }
};
