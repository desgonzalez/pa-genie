import React, { useState, useEffect } from "react";

function App() {
  const [user, setUser] = useState(null);

  // 🔐 LOGIN FORM
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  // MAIN APP STATE
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  const [form, setForm] = useState({
    patient_name: "",
    payer_name: "",
    cpt_codes: "",
    icd10_codes: ""
  });

  const [authForm, setAuthForm] = useState({
    auth_number: "",
    submission_status: "PENDING",
    auth_start_date: "",
    auth_end_date: ""
  });

  // 🔐 LOGIN HANDLER
  const handleLogin = (e) => {
    e.preventDefault();

    if (loginForm.email && loginForm.password) {
      setUser(loginForm.email);
      localStorage.setItem("user", loginForm.email);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(savedUser);
  }, []);

  const fetchCases = () => {
    fetch("https://pa-genie-backend.onrender.com/pa-cases")
      .then(res => res.json())
      .then(setCases);
  };

  useEffect(() => {
    if (user) fetchCases();
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();

    fetch("https://pa-genie-backend.onrender.com/pa-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        visit_type: "IN_OFFICE",
        chart_note_text: "Created from UI"
      })
    }).then(fetchCases);
  };

  const handleAuthUpdate = () => {
    const payload = {};
    if (authForm.auth_number) payload.auth_number = authForm.auth_number;
    if (authForm.submission_status) payload.submission_status = authForm.submission_status;
    if (authForm.auth_start_date) payload.auth_start_date = authForm.auth_start_date;
    if (authForm.auth_end_date) payload.auth_end_date = authForm.auth_end_date;

    fetch(`https://pa-genie-backend.onrender.com/pa-cases/${selectedCase.id}/auth`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(() => {
      fetchCases();
      setSelectedCase({ ...selectedCase, ...payload });
    });
  };

  // 🔐 LOGIN SCREEN
  if (!user) {
    return (
      <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center" }}>
        <form onSubmit={handleLogin} style={{ padding:30, background:"white", borderRadius:10 }}>
          <h2>PA Genie Login</h2>
          <input placeholder="Email"
            onChange={e=>setLoginForm({...loginForm,email:e.target.value})}/>
          <input type="password" placeholder="Password"
            onChange={e=>setLoginForm({...loginForm,password:e.target.value})}/>
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  // 🏥 MAIN APP
  return (
    <div style={{ padding:30 }}>
      <h1>PA Genie</h1>
      <button onClick={handleLogout}>Logout</button>

      {/* CREATE */}
      <form onSubmit={handleSubmit}>
        <input placeholder="Patient"
          onChange={e=>setForm({...form,patient_name:e.target.value})}/>
        <input placeholder="Insurance"
          onChange={e=>setForm({...form,payer_name:e.target.value})}/>
        <button>Create</button>
      </form>

      {/* LIST */}
      {cases.map(c => (
        <div key={c.id} onClick={()=>setSelectedCase(c)} style={{ cursor:"pointer" }}>
          {c.patient_name} — {c.submission_status}
        </div>
      ))}

      {/* DETAIL */}
      {selectedCase && (
        <div style={{ marginTop:20 }}>
          <h2>{selectedCase.patient_name}</h2>

          <input placeholder="Auth Number"
            onChange={e=>setAuthForm({...authForm,auth_number:e.target.value})}/>

          <select onChange={e=>setAuthForm({...authForm,submission_status:e.target.value})}>
            <option>PENDING</option>
            <option>APPROVED</option>
            <option>DENIED</option>
          </select>

          <button onClick={handleAuthUpdate}>Save</button>
        </div>
      )}
    </div>
  );
}

export default App;