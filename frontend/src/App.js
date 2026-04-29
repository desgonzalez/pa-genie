import React, { useState, useEffect } from "react";

const getStatus = (c) => {
  if (c.nurse_review_required) return { label: "NEEDS REVIEW", color: "#ef4444" };
  if (c.submission_status === "NO AUTH NEEDED") return { label: "NO AUTH", color: "#22c55e" };
  if (c.submission_status === "DENIED") return { label: "DENIED", color: "#f97316" };
  return { label: "APPROVED", color: "#3b82f6" };
};

const buildSummaryText = (c) => {
  return `
Patient: ${c.patient_name}
Insurance: ${c.payer_name}

CPT: ${c.suggested_cpt || c.cpt_codes}
DX: ${c.primary_diagnosis || c.icd10_codes}

Decision: ${getStatus(c).label}
Auth #: ${c.auth_number || "—"}
Ref #: ${c.reference_number || "—"}

Missing Docs: ${c.missing_docs || "None"}
  `.trim();
};

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

  const nurseCases = cases.filter(c => c.nurse_review_required);
  const readyCases = cases.filter(c => !c.nurse_review_required);

  const [form, setForm] = useState({
    patient_name: "",
    payer_name: "",
    cpt_codes: "",
    icd10_codes: "",
    chart_note_text: "",
    file: null
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

    const formData = new FormData();
    formData.append("patient_name", form.patient_name);
    formData.append("payer_name", form.payer_name);
    formData.append("cpt_codes", form.cpt_codes);
    formData.append("icd10_codes", form.icd10_codes);
    formData.append("chart_note_text", form.chart_note_text);

    if (form.file) {
      formData.append("file", form.file);
    }

    fetch(`${API}/pa-cases`, {
      method: "POST",
      body: formData
    }).then(() => {
      fetchCases();
      setForm({
        patient_name: "",
        payer_name: "",
        cpt_codes: "",
        icd10_codes: "",
        chart_note_text: "",
        file: null
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
          note.match(/(?:Auth(?:orization)?\s*#|Authorization Number)\s*[:\-]?\s*([A-Z0-9-]{5,})/i);

        const refMatch =
          note.match(/reference number(?: for this inquiry)?\s*[:\-]?\s*([A-Z0-9-]{5,})/i) ||
          note.match(/reference\s*#\s*[:\-]?\s*([A-Z0-9-]{5,})/i);

        const unitsMatch = note.match(/(\d+)\s*(?:units|visits)/i);

        const dateMatch = note.match(
          /(\d{2}\/\d{2}\/\d{4}).*(\d{2}\/\d{2}\/\d{4})/
        );

        const suggestedMatch = note.match(/Suggested CPT:\s*(.*)/i);
        const docsMatch = note.match(/Missing Documentation:\s*(.*)/i);
        const nurseMatch = note.match(/Nurse Review Required:\s*(Yes|No)/i);

        const diagnosisMatch = note.match(/Primary Diagnosis:\s*(.*)/i);
        const symptomsMatch = note.match(/Symptoms:\s*(.*)/i);
        const treatmentMatch = note.match(/Prior Treatment:\s*(.*)/i);
        const necessityMatch = note.match(/Medical Necessity:\s*(.*)/i);

        const updatedCase = {
          ...selectedCase,
          call_notes: note,
          auth_number: authMatch ? authMatch[1] : "",
          reference_number: refMatch ? refMatch[1] : "",
          units: unitsMatch ? unitsMatch[1] : "",
          auth_start_date: dateMatch ? dateMatch[1] : "",
          auth_end_date: dateMatch ? dateMatch[2] : "",
          suggested_cpt: suggestedMatch ? suggestedMatch[1] : "",
          missing_docs: docsMatch ? docsMatch[1] : "",
          nurse_review_required: nurseMatch
            ? nurseMatch[1].toLowerCase() === "yes"
            : false,
          submission_status: note.toLowerCase().includes("denied")
            ? "DENIED"
            : note.toLowerCase().includes("not required")
            ? "NO AUTH NEEDED"
            : "APPROVED",

          // ✅ Structured extraction
          primary_diagnosis: diagnosisMatch ? diagnosisMatch[1] : "",
          symptoms: symptomsMatch ? symptomsMatch[1] : "",
          prior_treatment: treatmentMatch ? treatmentMatch[1] : "",
          medical_necessity: necessityMatch ? necessityMatch[1] : ""
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
      .catch(() => alert("AI call failed"));
  };

  if (!user) {
    return (
      <div style={styles.center}>
        <form onSubmit={handleLogin} style={styles.card}>
          <h2>PA Genie Login</h2>
          <input placeholder="Email"
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
          <input type="password" placeholder="Password"
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
          <button>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <div style={styles.sidebar}>
        <h2>PA Genie</h2>
      </div>

      <div style={styles.main}>
        <div style={styles.card}>
          <h3>Create Case</h3>
          <form onSubmit={handleSubmit}>
            <input placeholder="Patient Name"
              value={form.patient_name}
              onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />

            <input placeholder="Insurance"
              value={form.payer_name}
              onChange={(e) => setForm({ ...form, payer_name: e.target.value })} />

            <input placeholder="CPT Codes"
              value={form.cpt_codes}
              onChange={(e) => setForm({ ...form, cpt_codes: e.target.value })} />

            <input placeholder="ICD10 Codes"
              value={form.icd10_codes}
              onChange={(e) => setForm({ ...form, icd10_codes: e.target.value })} />

            <textarea
              placeholder="Paste provider note here"
              value={form.chart_note_text}
              onChange={(e) =>
                setForm({ ...form, chart_note_text: e.target.value })
              }
              rows={5}
              style={{ width: "100%", marginTop: 10 }}
            />

            <input
              type="file"
              accept="application/pdf"
              onChange={(e) =>
                setForm({ ...form, file: e.target.files[0] })
              }
              style={{ marginTop: 10 }}
            />
            
             {form.file && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                📄 Uploaded: {form.file.name}
              </div>
            )}

            <button>Create</button>
          </form>
        </div>

        <div style={styles.card}>
          <h3>🔴 Needs Nurse Review</h3>
          {nurseCases.map((c) => (
            <div key={c.id}
              style={{ ...styles.caseItem, borderLeft: "4px solid red" }}
              onClick={() => {
                setSelectedCase(c);
                setCallLog(c.call_notes || "");
              }}>
              <strong>{c.patient_name}</strong>
              <div>{c.payer_name}</div>
            </div>
          ))}

          <h3 style={{ marginTop: 20 }}>✅ Ready / Completed</h3>
          {readyCases.map((c) => (
            <div key={c.id}
              style={styles.caseItem}
              onClick={() => {
                setSelectedCase(c);
                setCallLog(c.call_notes || "");
              }}>
              <strong>{c.patient_name}</strong>
              <div>{c.payer_name}</div>
            </div>
          ))}
        </div>

        {selectedCase && (
  <div style={styles.card}>
    <h2>{selectedCase.patient_name}</h2>

    {/* STATUS BADGE */}
    <div style={{
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 6,
      background: getStatus(selectedCase).color,
      color: "white",
      marginBottom: 15,
      fontSize: 12,
      fontWeight: 600
    }}>
      {getStatus(selectedCase).label}
    </div>

    {/* DECISION SUMMARY */}
    <div style={{
      border: "1px solid #ddd",
      padding: 15,
      borderRadius: 10,
      marginBottom: 20,
      background: "#f8fafc"
    }}>
      <h3>Decision Summary</h3>
      <div>
        <div><b>CPT:</b> {selectedCase.suggested_cpt || selectedCase.cpt_codes}</div>
        <div><b>Diagnosis:</b> {selectedCase.primary_diagnosis || selectedCase.icd10_codes}</div>
        <div><b>Authorization:</b> {selectedCase.auth_number || "Not Required"}</div>
        <div><b>Missing:</b> {selectedCase.missing_docs || "None"}</div>
      </div>
    </div>

    {/* ACTION BUTTONS */}
    <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      <button onClick={runAISimulation}>🤖 Run AI</button>

      <button onClick={() => {
        navigator.clipboard.writeText(buildSummaryText(selectedCase));
        alert("Copied summary");
      }}>
        📋 Copy
      </button>

      <button onClick={() => {
        const updated = { ...selectedCase, nurse_review_required: false };
        setSelectedCase(updated);
        setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
      }}>
        ✅ Approve
      </button>

      <button onClick={() => {
        const updated = { ...selectedCase, nurse_review_required: true };
        setSelectedCase(updated);
        setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
      }}>
        ❌ Needs Info
      </button>
    </div>

    {/* INFO GRID */}
    <div style={styles.infoGrid}>
      <div style={styles.infoBox}>
        <strong>CPT</strong>
        <input
          value={selectedCase.cpt_codes || ""}
          onChange={(e) =>
            setSelectedCase({ ...selectedCase, cpt_codes: e.target.value })
          }
        />
      </div>

      <div style={styles.infoBox}>
        <strong>DX</strong>
        <input
          value={selectedCase.icd10_codes || ""}
          onChange={(e) =>
            setSelectedCase({ ...selectedCase, icd10_codes: e.target.value })
          }
        />
      </div>

      <div style={styles.infoBox}>
        <strong>Suggested CPT</strong>
        <div>{selectedCase.suggested_cpt || "—"}</div>
      </div>

      <div style={styles.infoBox}>
        <strong>Missing Docs</strong>
        <div>{selectedCase.missing_docs || "—"}</div>
      </div>

      <div style={styles.infoBox}>
        <strong>Diagnosis</strong>
        <div>{selectedCase.primary_diagnosis || "—"}</div>
      </div>

      <div style={styles.infoBox}>
        <strong>Symptoms</strong>
        <div>{selectedCase.symptoms || "—"}</div>
      </div>

      <div style={styles.infoBox}>
        <strong>Prior Treatment</strong>
        <div>{selectedCase.prior_treatment || "—"}</div>
      </div>

      <div style={styles.infoBox}>
        <strong>Medical Necessity</strong>
        <div>{selectedCase.medical_necessity || "—"}</div>
      </div>
    </div>

    {/* TIMELINE */}
    {callLog && (
      <div style={styles.timelineCard}>
        <h3>Case Timeline</h3>
        {callLog.split("--------------------").reverse().map((entry, idx) => (
          <div key={idx} style={styles.timelineItem}>
            <div style={styles.timelineDot}></div>
            <div style={styles.log}>
              {formatCallNote(entry.trim())}
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
  layout: { display: "flex", minHeight: "100vh" },
  sidebar: { width: 200, background: "#0f172a", color: "white", padding: 20 },
  main: { flex: 1, padding: 20 },
  card: { background: "white", padding: 20, marginBottom: 20, borderRadius: 10 },
  caseItem: { padding: 10, border: "1px solid #ddd", marginBottom: 8, cursor: "pointer" },
  center: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  infoBox: { border: "1px solid #ddd", padding: 10 },
  timelineCard: { marginTop: 20 },
  timelineItem: { display: "flex", gap: 10 },
  timelineDot: { width: 10, height: 10, background: "blue", borderRadius: "50%" },
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




