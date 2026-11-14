// Static ASCII astronaut (drawn for FARSIDE): helmet with visor, backpack, arms, legs.
const ART = String.raw`
           .-~~~~~~~~-.
         .'  ________  '.
        /   /        \   \
   ____|   |  .--.    |   |____
  |    |   |  '--'    |   |    |
  |    |    \________/    |    |
  |    |'.              .'|    |
  |    |  '-.________.-'  |    |
  |___ /==================\ ___|
     //|   [==]  [ o o ]   |\\
    // |                   | \\
   //  |   [__________]    |  \\
  ||   |   |  FARSIDE |    |   ||
  ()   |   |__________|    |   ()
       |___________________|
       |    |         |    |
       |    |         |    |
       |    |         |    |
       |____|         |____|
       |    |         |    |
       |    |         |    |
     __|    |__     __|    |__
    |_________|     |_________|
`.slice(1);

export function StaticAstronaut() {
  return (
    <pre aria-label="ASCII astronaut" className="m-0 leading-tight text-fg">
      {ART}
    </pre>
  );
}
