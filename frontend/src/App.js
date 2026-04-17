import React, { useState, useEffect } from "react";

const API = "https://pa-genie-backend.onrender.com";

const formatCallNote = (note) => {
  return note
    .split("\n")
    .filter((line) => line.trim())
    .map((line, idx) => (
      <div key={idx} style={{ marginBottom: 10 }}>
        {line.startsWith("🕒") ? (
          <div style={{ fontWeight: 700, color: "#60a5fa" }}>{line}</div>
        ) : line.toLowerCase().includes("reference") ||
          line.toLowerCase().includes("auth") ? (
          <div style={{ fontWeight: 700, color: "#facc15" }}>{line}</div>
        ) : (
          <div>{line}</div>
        )}
      </div>
    ));
};

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

  const fetchCases = () => {
    fetch(`${API}/pa-cases`)
      .then((res) => res.json())
      .then(setCases);
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.email && loginForm.password) {
      setUser(loginForm.email);
      localStorage.setItem("user", loginForm.email);
    }
  };

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
        const note = data.call_notes || "";

        const authMatch =
          note.match(/Auth(?:orization)?\s*#?\s*[:\-]?\s*([A-Z0-9-]+)/i) ||
          note.match(/authorization number\s*[:\-]?\s*([A-Z0-9-]+)/i);

        const refMatch =
          note.match(/Reference\s*#\s*[:\-]?\s*([A-Z0-9-]+)/i) ||
          note.match(/reference number\s*[:\-]?\s*([A-Z0-9-]+)/i);

        const unitsMatch =
          note.match(/(\d+)\s*(?:units|visits)/i);

        const dateMatch = note.match(
          /(\d{2}\/\d{2}\/\d{4}).*(\d{2}\/\d{2}\/\d{4})/
        );

        const updatedCase = {
          ...selectedCase,
          call_notes: note,
          auth_number: authMatch ? authMatch[1] : "",
          reference_number: refMatch ? refMatch[1] : "",
          units: unitsMatch ? unitsMatch[1] : "",
          auth_start_date: dateMatch ? dateMatch[1] : "",
          auth_end_date: dateMatch ? dateMatch[2] : "",
          submission_status: note.toLowerCase().includes("denied")
            ? "DENIED"
            : note.toLowerCase().includes("not required")
            ? "NO AUTH NEEDED"
            : "APPROVED"
        };

        setSelectedCase(updatedCase);

        setCases((prev) =>
          prev.map((c) => (c.id === updatedCase.id ? updatedCase : c))
        );

        setCallLog((prev) => {
          if (!prev) return note;
          return `${prev}\n\n--------------------\n\n${note}`;
        });
      })
      .catch((err) => {
        console.error(err);
        alert("Unable to run AI call.");
      });
  };

  if (!user) {
    return (
      <div style={styles.center}>
        <form onSubmit={handleLogin} style={styles.card}>
          <h2>PA Genie Login</h2>
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
              onChange={(e) =>
                setForm({ ...form, patient_name: e.target.value })
              }
            />
            <input
              placeholder="Insurance"
              value={form.payer_name}
              onChange={(e) =>
                setForm({ ...form, payer_name: e.target.value })
              }
            />
            <input
              placeholder="CPT Codes"
              value={form.cpt_codes}
              onChange={(e) =>
                setForm({ ...form, cpt_codes: e.target.value })
              }
            />
            <input
              placeholder="ICD10 Codes"
              value={form.icd10_codes}
              onChange={(e) =>
                setForm({ ...form, icd10_codes: e.target.value })
              }
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
            <div style={styles.headerRow}>
              <div>
                <h2>{selectedCase.patient_name}</h2>
                <div>{selectedCase.payer_name}</div>
              </div>

              <div
                style={{
                  ...styles.statusBadge,
                  background:
                    selectedCase.submission_status === "APPROVED"
                      ? "#dcfce7"
                      : selectedCase.submission_status === "DENIED"
                      ? "#fee2e2"
                      : "#fef3c7",
                  color:
                    selectedCase.submission_status === "APPROVED"
                      ? "#166534"
                      : selectedCase.submission_status === "DENIED"
                      ? "#991b1b"
                      : "#92400e"
                }}
              >
                {selectedCase.submission_status || "PENDING"}
              </div>
            </div>

            <button onClick={runAISimulation}>🤖 Run AI Call</button>

            <div style={styles.infoGrid}>
              <div style={styles.infoBox}>
                <strong>CPT Codes</strong>
                <div>{selectedCase.cpt_codes || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <strong>Diagnosis Codes</strong>
                <div>{selectedCase.icd10_codes || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <strong>Units / Visits</strong>
                <div>{selectedCase.units || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <strong>Authorization #</strong>
                <div>{selectedCase.auth_number || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <strong>Reference #</strong>
                <div>{selectedCase.reference_number || "—"}</div>
              </div>

              <div style={styles.infoBox}>
                <strong>Valid Dates</strong>
                <div>
                  {selectedCase.auth_start_date
                    ? `${selectedCase.auth_start_date} - ${selectedCase.auth_end_date}`
                    : "—"}
                </div>
              </div>
            </div>

            {callLog && (
              <div style={styles.timelineCard}>
                <h3>Case Timeline</h3>

                {callLog
                  .split("--------------------")
                  .reverse()
                  .map((entry, idx) => (
                    <div key={idx} style={styles.timelineItem}>
                      <div style={styles.timelineDot}></div>
                      <div style={{ flex: 1 }}>
                        <strong>AI Insurance Call</strong>
                        <div style={styles.log}>
                          {formatCallNote(entry.trim())}
                        </div>
                      </div>
                    </div>
                  ))}
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  statusBadge: {
    padding: "8px 14px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 20,
    marginBottom: 20
  },
  infoBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
    background: "#f8fafc"
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





