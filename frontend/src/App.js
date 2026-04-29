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

  const allowedUsers = [
    { email: "admin@pagenie.com", password: "admin123" },
    { email: "clinic@test.com", password: "clinic123" }
  ];
  
  const handleLogin = (e) => {
    e.preventDefault();
  
    const match = allowedUsers.find(
      (u) =>
        u.email === loginForm.email &&
        u.password === loginForm.password
    );
  
    if (match) {
      setUser(match.email);
      localStorage.setItem("user", match.email);
    } else {
      alert("Invalid login");
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

        // ✅ CLEAN CPT
        const cleanCPT = suggestedMatch
          ? suggestedMatch[1].split(" ")[0]
          : "";

        // ✅ EXTRACT ICD10 CODE
        const extractedDX = diagnosisMatch
          ? diagnosisMatch[1].match(/\((.*?)\)/)?.[1]
          : "";

        const updatedCase = {
          ...selectedCase,
          call_notes: note,

          auth_number: authMatch ? authMatch[1] : "",
          reference_number: refMatch ? refMatch[1] : "",
          units: unitsMatch ? unitsMatch[1] : "",
          auth_start_date: dateMatch ? dateMatch[1] : "",
          auth_end_date: dateMatch ? dateMatch[2] : "",

          suggested_cpt: cleanCPT,
          icd10_codes: extractedDX || selectedCase.icd10_codes,

          missing_docs: docsMatch ? docsMatch[1] : "",

          nurse_review_required: nurseMatch
            ? nurseMatch[1].toLowerCase() === "yes"
            : false,

          submission_status: note.toLowerCase().includes("denied")
            ? "DENIED"
            : note.toLowerCase().includes("not required")
            ? "NO AUTH NEEDED"
            : "APPROVED",

          primary_diagnosis: diagnosisMatch ? diagnosisMatch[1] : "",
          symptoms: symptomsMatch ? symptomsMatch[1] : "",
          prior_treatment: treatmentMatch ? treatmentMatch[1] : "",
          medical_necessity: necessityMatch ? necessityMatch[1] : ""
        };

        setSelectedCase(updatedCase);
        setCases((prev) =>
          prev.map((c) => (c.id === updatedCase.id ? updatedCase : c))
        );

        setCallLog((prev) =>
          !prev ? note : `${prev}\n\n--------------------\n\n${note}`
        );
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
      <button
        style={{ marginTop: 20 }}
        onClick={() => {
    localStorage.removeItem("user");
    setUser(null);
  }}
>
  Logout
</button>
        <h2>PA Genie</h2>
      </div>

      <div style={styles.main}>

        {/* CASE DETAIL */}
        {selectedCase && (
          <div style={styles.card}>
            <h2>{selectedCase.patient_name}</h2>

            <div style={{
              background: getStatus(selectedCase).color,
              color: "white",
              padding: "6px 10px",
              borderRadius: 6,
              display: "inline-block",
              marginBottom: 15
            }}>
              {getStatus(selectedCase).label}
            </div>

            <div style={{
              border: "1px solid #ddd",
              padding: 15,
              borderRadius: 10,
              marginBottom: 20
            }}>
              <h3>Decision Summary</h3>
              <div>
                <div><b>CPT:</b> {selectedCase.suggested_cpt || selectedCase.cpt_codes}</div>
                <div><b>Diagnosis:</b> {selectedCase.primary_diagnosis || selectedCase.icd10_codes}</div>
                <div><b>Authorization:</b> {selectedCase.auth_number || "Not Required"}</div>
                <div><b>Missing:</b> {selectedCase.missing_docs || "None"}</div>
                <div><b>Next Step:</b> {selectedCase.nurse_review_required ? "Review Required" : "Ready to Submit"}</div>
                <div><b>Confidence:</b> High</div>
              </div>
            </div>

            <button onClick={runAISimulation}>🤖 Run AI</button>
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
  center: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }
};



