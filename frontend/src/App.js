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

  const fetchCases = () => {
    fetch(`${API}/pa-cases`)
      .then(res => res.json())
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
    }).then(fetchCases);
  };

  // 🤖 AI SIMULATION (REALISTIC WORKFLOW)
  const runAISimulation = () => {
    const repName = ["Jessica", "Michael", "Sarah", "David"][Math.floor(Math.random()*4)];
    const lastInitial = ["A","B","C","D"][Math.floor(Math.random()*4)];
    const needsAuth = Math.random() > 0.3;

    let log = `📞 Call started\nRep: ${repName} ${lastInitial}.\nCall recorded.\n`;

    if (!needsAuth) {
      const ref = "REF" + Math.floor(Math.random()*100000);
      log += `No authorization required.\nReference #: ${ref}`;
      
      updateCase({
        submission_status: "APPROVED",
        auth_number: ref,
        call_notes: log
      });

    } else {
      const auth = "AUTH" + Math.floor(Math.random()*100000);
      const units = Math.floor(Math.random()*10)+1;

      log += `Authorization required.\n`;
      log += `Auth #: ${auth}\nUnits: ${units}\nValid: 04/10 - 05/10\n`;

      if (Math.random() > 0.7) {
        log += `⚠️ Nurse review required — routed to human.\n`;
      }

      updateCase({
        submission_status: "APPROVED",
        auth_number: auth,
        call_notes: log
      });
    }

    setCallLog(log);
  };

  const updateCase = (payload) => {
    fetch(`${API}/pa-cases/${selectedCase.id}/auth`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(() => {
      fetchCases();
      setSelectedCase(null);
    });
  };

  const getStatusColor = (status) => {
    if (status === "APPROVED") return "#22c55e";
    if (status === "DENIED") return "#ef4444";
    return "#facc15";
  };

  if (!user) {
    return (
      <div style={styles.center}>
        <form onSubmit={handleLogin} style={styles.card}>
          <h2>PA Genie</h2>
          <input placeholder="Email" onChange={e=>setLoginForm({...loginForm,email:e.target.value})}/>
          <input type="password" placeholder="Password" onChange={e=>setLoginForm({...loginForm,password:e.target.value})}/>
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
            <input placeholder="Patient" onChange={e=>setForm({...form,patient_name:e.target.value})}/>
            <input placeholder="Insurance" onChange={e=>setForm({...form,payer_name:e.target.value})}/>
            <button>Create</button>
          </form>
        </div>

        <div style={styles.card}>
          <h3>Cases</h3>
          {cases.map(c => (
            <div key={c.id} onClick={()=>setSelectedCase(c)} style={styles.caseItem}>
              <strong>{c.patient_name}</strong>
              <div style={{ color:getStatusColor(c.submission_status) }}>
                {c.submission_status}
              </div>
            </div>
          ))}
        </div>

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

const styles = {
  layout: { display:"flex", height:"100vh", fontFamily:"sans-serif" },
  sidebar: { width:200, background:"#0f172a", color:"white", padding:20 },
  main: { flex:1, padding:20, background:"#f8fafc" },
  card: { background:"white", padding:20, borderRadius:10, marginBottom:20 },
  caseItem: { padding:10, marginBottom:8, background:"#f1f5f9", borderRadius:8, cursor:"pointer" },
  center: { display:"flex", height:"100vh", alignItems:"center", justifyContent:"center" },
  log: { marginTop:15, background:"#0f172a", color:"lime", padding:10 }
};