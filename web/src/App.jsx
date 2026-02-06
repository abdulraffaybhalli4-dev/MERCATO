import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "./api.js";

const emptyForm = { name: "" };
const categories = [
  "ARMI BIANCHE", 
  "ARMI LEGGERE",
  "ARMI PESANTI",
  "ACCESSORI",
  "COLPI ARMA",
  "EXTRA",
  "SPEDIZIONE"
];

function typeFromCategory(category) {
  if (category === "COLPI ARMA") return "colpi";
  if (category === "ACCESSORI" || category === "EXTRA" || category === "SPEDIZIONE") return "accessorio";
  return "arma";
}

function Dashboard() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportData, setReportData] = useState(null);
  const [resetStatus, setResetStatus] = useState("");
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadAdmin();
  }, []);

  async function loadAdmin() {
    try {
      const data = await apiGet("/api/admin/me");
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await apiSend("/api/admin/login", "POST", { username, password });
      setAdmin(data.admin);
      setPassword("");
    } catch {
      setError("Credenziali non valide");
    }
  }

  async function logoutAdmin() {
    await apiSend("/api/admin/logout", "POST", {});
    setAdmin(null);
  }

  async function refreshActiveUsers() {
    const data = await apiGet("/api/admin/active-users?withinMinutes=10");
    setActiveUsers(data.users || []);
  }

  async function resetOrders() {
    setResetStatus("");
    await apiSend("/api/admin/reset-orders", "POST", {});
    setResetStatus("Ordini azzerati");
  }

  async function runReport() {
    const data = await apiGet(`/api/admin/reports?from=${reportFrom}&to=${reportTo}`);
    setReportData(data);
  }

  async function loadLogs() {
    const data = await apiGet("/api/admin/logs");
    setLogs(data.logs || []);
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Dashboard</h2>
          <p>Caricamento...</p>
        </section>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Dashboard</h2>
          <p>Accesso amministratore</p>
          <form className="grid" onSubmit={login}>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <div className="error-text">{error}</div>}
            <button type="submit">Login</button>
          </form>
          <button className="ghost" onClick={() => (window.location.href = "/")}>Torna al sito</button>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="space-bg" aria-hidden="true"></div>
      <div id="stars"></div>
      <div id="stars2"></div>
      <div id="stars3"></div>
      <div className="app">
        <header className="hero">
          <div>
            <h1>Dashboard</h1>
            <p>Gestione ordini, utenti attivi e report.</p>
          </div>
          <div className="hero-actions">
            <button className="ghost" onClick={() => (window.location.href = "/")}>Vai al sito</button>
            <button onClick={logoutAdmin}>Logout</button>
          </div>
        </header>

        <section className="card">
          <h2>Utenti attivi (ultimi 10 min)</h2>
          <div className="grid two">
            <button onClick={refreshActiveUsers}>Aggiorna</button>
          </div>
          <div className="list">
            {activeUsers.length === 0 && <div className="stat">Nessun utente attivo</div>}
            {activeUsers.map((u) => (
              <div key={u.id} className="list-item">
                <strong>{u.username}</strong> <span className="muted">({u.id})</span>
                <span className="muted"> — ultimo accesso: {u.lastSeen}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Reset ordini</h2>
          <div className="grid two">
            <button className="danger" onClick={resetOrders}>Azzera ordini</button>
            <div className="stat">{resetStatus}</div>
          </div>
        </section>

        <section className="card">
          <h2>Report ordini</h2>
          <div className="grid three">
            <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            <button onClick={runReport} disabled={!reportFrom || !reportTo}>Genera</button>
          </div>
          {reportData && (
            <div className="list">
              <div className="list-item">
                Totali — Ordini: {reportData.totals.orderCount} | Pulito: {reportData.totals.totalClean} | Sporco: {reportData.totals.totalDirty}
              </div>
              {reportData.byFamily.map((row) => (
                <div key={row.familyId} className="list-item">
                  {row.familyName}: {row.orderCount} ordini — Pulito {row.totalClean} | Sporco {row.totalDirty}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Log</h2>
          <button onClick={loadLogs}>Carica log</button>
          <div className="list">
            {logs.length === 0 && <div className="stat">Nessun log disponibile</div>}
            {logs.map((line, idx) => (
              <div key={idx} className="list-item">{line}</div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default function App() {
  const isDashboard = window.location.pathname.startsWith("/dashboard");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [families, setFamilies] = useState([]);
  const [familyForm, setFamilyForm] = useState(emptyForm);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [history, setHistory] = useState([]);

  const [calcAmount, setCalcAmount] = useState("");
  const [calcPercent, setCalcPercent] = useState("");

  const [items, setItems] = useState([]);

  const [orderFamilyId, setOrderFamilyId] = useState("");
  const [orderLines, setOrderLines] = useState([]);
  const [orderResult, setOrderResult] = useState(null);
  const [orderCategory, setOrderCategory] = useState(categories[0]);
  const [orderItemId, setOrderItemId] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);

  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (isDashboard) {
      setAuthLoading(false);
      return;
    }
    loadAuth();
  }, [isDashboard]);

  useEffect(() => {
    if (!authUser) return;
    refreshFamilies();
    refreshItems();
  }, [authUser]);

  useEffect(() => {
    if (selectedFamilyId) loadHistory(selectedFamilyId);
  }, [selectedFamilyId]);

  useEffect(() => {
    const first = items.find((item) => item.category === orderCategory);
    if (first) {
      setOrderItemId(String(first.id));
    } else {
      setOrderItemId("");
    }
  }, [items, orderCategory]);

  async function loadAuth() {
    try {
      const data = await apiGet("/api/auth/me");
      setAuthUser(data.user);
    } catch {
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await apiSend("/api/auth/logout", "POST", {});
    setAuthUser(null);
  }

  async function refreshFamilies() {
    const data = await apiGet("/api/families");
    setFamilies(data);
    if (!selectedFamilyId && data.length) {
      setSelectedFamilyId(String(data[0].id));
      setOrderFamilyId(String(data[0].id));
    }
  }

  async function loadHistory(familyId) {
    const data = await apiGet(`/api/families/${familyId}/history`);
    setHistory(data);
  }

  async function refreshItems() {
    const data = await apiGet("/api/items");
    setItems(data);
  }

  const calcDue = useMemo(() => {
    const amount = Number(calcAmount) * 0.5;
    const percent = Number(calcPercent);
    if (!amount || !percent) return 0;
    return amount * (percent / 100);
  }, [calcAmount, calcPercent]);

  async function addFamily(e) {
    e.preventDefault();
    await apiSend("/api/families", "POST", { name: familyForm.name });
    setFamilyForm(emptyForm);
    refreshFamilies();
  }

  async function deleteFamily(id) {
    await apiSend(`/api/families/${id}`, "DELETE");
    refreshFamilies();
  }

  async function saveCalculation() {
    if (!selectedFamilyId) return;
    await apiSend(`/api/families/${selectedFamilyId}/history`, "POST", {
      amount: Number(calcAmount),
      percent: Number(calcPercent)
    });
    setCalcAmount("");
    setCalcPercent("");
    loadHistory(selectedFamilyId);
  }

  function updateOrderLine(itemId, quantity) {
    setOrderLines((prev) => {
      const existing = prev.find((l) => l.itemId === itemId);
      if (!quantity || Number(quantity) === 0) {
        return prev.filter((l) => l.itemId !== itemId);
      }
      if (existing) {
        return prev.map((l) => (l.itemId === itemId ? { ...l, quantity } : l));
      }
      return [...prev, { itemId, quantity }];
    });
  }

  function addOrderLine() {
    if (!orderItemId || !orderQuantity) return;
    updateOrderLine(Number(orderItemId), Number(orderQuantity));
    setOrderQuantity(1);
  }

  const orderTotals = useMemo(() => {
    let totalClean = 0;
    for (const line of orderLines) {
      const item = items.find((i) => i.id === line.itemId);
      if (!item) continue;
      totalClean += Number(item.unit_price) * Number(line.quantity);
    }
    const shippingItem = items.find((item) => item.category === "SPEDIZIONE" && item.name === "Spedizione");
    if (shippingItem) {
      totalClean += Number(shippingItem.unit_price);
    }
    return {
      totalClean,
      totalDirty: totalClean * 2
    };
  }, [orderLines, items]);

  async function saveOrder() {
    if (orderLines.length === 0) return;
    const payload = {
      items: orderLines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }))
    };
    if (orderFamilyId) {
      payload.familyId = Number(orderFamilyId);
    }
    const result = await apiSend("/api/orders", "POST", payload);
    setOrderResult(result);
    setOrderLines([]);
  }

  async function runReport() {
    const data = await apiGet(`/api/reports?from=${reportFrom}&to=${reportTo}`);
    setReportData(data);
  }

  if (isDashboard) {
    return <Dashboard />;
  }

  if (authLoading) {
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Accesso</h2>
          <p>Caricamento...</p>
        </section>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="auth-screen">
        <section className="card auth-card">
          <h2>Accesso richiesto</h2>
          <p>Accedi con Discord per usare il sito.</p>
          <button onClick={() => (window.location.href = "/api/auth/login")}>Accedi con Discord</button>
        </section>
      </div>
    );
  }

  const orderCategoryItems = items.filter((item) => item.category === orderCategory);
  const selectedOrderItem = items.find((item) => String(item.id) === String(orderItemId));
  const selectedLineClean = selectedOrderItem ? Number(selectedOrderItem.unit_price) * Number(orderQuantity) : 0;
  const selectedLineDirty = selectedLineClean * 2;

  const floaters = [
    { top: "12%", left: "8%", size: 84, delay: "0s", duration: "9s" },
    { top: "20%", left: "78%", size: 90, delay: "1s", duration: "11s" },
    { top: "48%", left: "12%", size: 80, delay: "2s", duration: "10s" },
    { top: "55%", left: "82%", size: 96, delay: "0.5s", duration: "12s" },
    { top: "78%", left: "20%", size: 86, delay: "1.5s", duration: "13s" },
    { top: "70%", left: "70%", size: 78, delay: "2.5s", duration: "9.5s" },
    { top: "10%", left: "45%", size: 72, delay: "0.2s", duration: "10.5s" },
    { top: "30%", left: "5%", size: 68, delay: "1.8s", duration: "12.5s" },
    { top: "32%", left: "92%", size: 74, delay: "0.8s", duration: "11.2s" },
    { top: "60%", left: "48%", size: 88, delay: "2.2s", duration: "14s" },
    { top: "86%", left: "58%", size: 70, delay: "1.2s", duration: "9.8s" },
    { top: "88%", left: "10%", size: 76, delay: "2.8s", duration: "10.8s" }
  ];

  return (
    <>
      <div className="space-bg" aria-hidden="true"></div>
      <div id="stars"></div>
      <div id="stars2"></div>
      <div id="stars3"></div>
      <div className="floaters">
        {floaters.map((f, idx) => (
          <div
            key={idx}
            className="floater"
            style={{ top: f.top, left: f.left, width: f.size, height: f.size, animationDelay: f.delay, animationDuration: f.duration }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4h-2l-1 2v2h2l3.6 7.59-1.35 2.44a1 1 0 0 0 .85 1.48h12v-2h-10.42a.25.25 0 0 1-.22-.37l.94-1.7h7.7a1 1 0 0 0 .9-.55l3.58-6.49a.5.5 0 0 0-.44-.74h-15.1l-.94-2zm1 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </div>
        ))}
      </div>
      <div className="app">
      <header className="hero">
        <div>
          <h1>
            Mercato Nero
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              style={{ marginLeft: 8, verticalAlign: "-2px", animation: "cartPulse 2.2s ease-in-out infinite" }}
            >
              <path d="M7 4h-2l-1 2v2h2l3.6 7.59-1.35 2.44a1 1 0 0 0 .85 1.48h12v-2h-10.42a.25.25 0 0 1-.22-.37l.94-1.7h7.7a1 1 0 0 0 .9-.55l3.58-6.49a.5.5 0 0 0-.44-.74h-15.1l-.94-2zm1 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
            </svg>
          </h1>
          <p>Gestione famiglie, pulizia, listino, ordini e resoconti.</p>
        </div>
        <div>
          <div className="stat">Connesso: {authUser.username}</div>
          <div className="hero-actions">
            <button className="ghost" onClick={() => (window.location.href = "/dashboard")}>Dashboard</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Calcolatore Pulizia</h2>
        <div className="grid three">
          <input
            type="number"
            placeholder="Importo"
            value={calcAmount}
            onChange={(e) => setCalcAmount(e.target.value)}
          />
          <input
            type="number"
            placeholder="Percentuale"
            value={calcPercent}
            onChange={(e) => setCalcPercent(e.target.value)}
          />
          <div className="stat">Dovuto: {calcDue.toFixed(2)}</div>
        </div>
        <button onClick={saveCalculation} disabled={!selectedFamilyId || !calcAmount || !calcPercent}>
          Calcola
        </button>
      </section>

      <section className="card">
        <h2>Ordini</h2>
        <div className="grid two">
          <div className="stat">Totale pulito: {orderTotals.totalClean.toFixed(2)} | Sporco: {orderTotals.totalDirty.toFixed(2)}</div>
        </div>
        <div className="grid three">
          <select value={orderCategory} onChange={(e) => setOrderCategory(e.target.value)}>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select value={orderItemId} onChange={(e) => setOrderItemId(e.target.value)}>
            {orderCategoryItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            placeholder="Qtà"
            value={orderQuantity}
            onChange={(e) => setOrderQuantity(Number(e.target.value))}
          />
        </div>
        <div className="grid two">
          <div className="stat">
            Selezionato: Pulito {selectedLineClean.toFixed(2)} | Sporco {selectedLineDirty.toFixed(2)}
          </div>
          <button onClick={addOrderLine} disabled={!orderItemId || !orderQuantity}>Aggiungi</button>
        </div>
        <div className="list">
          {orderLines.map((line) => {
            const item = items.find((i) => i.id === line.itemId);
            if (!item) return null;
            const lineClean = Number(item.unit_price) * Number(line.quantity);
            return (
              <div key={line.itemId} className="list-item">
                <span>
                  {item.category || "Senza categoria"} — {item.name} x{line.quantity} — Pulito {lineClean.toFixed(2)} / Sporco {(lineClean * 2).toFixed(2)}
                </span>
                <button className="danger" onClick={() => updateOrderLine(item.id, 0)}>Rimuovi</button>
              </div>
            );
          })}
        </div>
        <div className="stat">Spedizione obbligatoria: 100000 (pulito) / 200000 (sporco)</div>
        <button onClick={saveOrder} disabled={orderLines.length === 0}>Crea ordine</button>
        {orderResult && (
          <div className="stat">ID ordine: {orderResult.orderNumber} (usa /compra)</div>
        )}
      </section>

      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>
        &copy; 2026 Mercato Nero &bull; v2.2 Space UI
      </footer>
    </div>
    </>
  );
}
