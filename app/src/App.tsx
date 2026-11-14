import { useStream } from "./hooks/useStream";

// TEMP debug view: replaced by the real shell.
function App() {
  const { mode, readingsByCrew, solarEvent, loadScenario, resetReadings } = useStream();
  const last5 = Object.values(readingsByCrew)
    .flat()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-5);

  return (
    <main style={{ fontFamily: "system-ui", padding: 16 }}>
      <h1>FARSIDE</h1>
      <p>Mode: <strong>{mode}</strong></p>
      {solarEvent && (
        <p>Solar event: {String(solarEvent.data.sepID)} {solarEvent.cached && "(cached)"}</p>
      )}
      <button onClick={() => loadScenario().catch((e) => alert(e.message))}>Load Mars day 143</button>{" "}
      <button onClick={resetReadings}>Reset</button>
      <ul>
        {last5.map((r, i) => (
          <li key={i}>
            {r.timestamp} {r.crew_id} {r.type} = {String(r.value)} {r.unit} ({r.source})
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
