export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090a09", color: "#f0f0e9", fontFamily: "Arial, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 520 }}>
        <p style={{ color: "#d8f34a", fontSize: 12, letterSpacing: ".14em" }}>RIFT / SYNC</p>
        <h1 style={{ fontSize: "clamp(3rem, 8vw, 5rem)", letterSpacing: "-.07em", margin: "1rem 0" }}>Online.</h1>
        <p style={{ color: "#a8ada2", lineHeight: 1.6 }}>Acest serviciu sincronizează sesiunile temporare RIFT dintre laptop și iPhone. Experiența se deschide pe GitHub Pages.</p>
        <a href="https://mmarius-03.github.io/vizor/rift/" style={{ display: "inline-block", marginTop: 22, background: "#d8f34a", color: "#11140a", padding: "14px 20px", textDecoration: "none", fontWeight: 700 }}>Deschide RIFT ↗</a>
      </div>
    </main>
  );
}
