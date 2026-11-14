// All landing page text in one place.
export const COPY = {
  boot: [
    "FARSIDE v1.0  crew health station",
    "[ OK ] baselines: NASA OSDR Inspiration4 (OSD-569, OSD-575)",
    "[ OK ] space weather: NASA DONKI solar particle events (cached)",
    "[ OK ] stress model: WESAD, leave-one-subject-out, 15 people",
    "[INFO] delay router: who acts depends on the round trip to Earth",
  ],
  sections: [
    {
      cmd: "farside --why",
      out: [
        "On the ISS a doctor on Earth answers in seconds.",
        "On Mars the round trip to Earth is up to 44 minutes.",
        "During solar conjunction there is no link at all.",
        "The crew needs to know when to wait for Earth and when to act.",
      ],
    },
    {
      cmd: "farside --how",
      out: [
        "station ....... STAND-REACT: 20 s reaction test and balance sway on an Arduino",
        "engine ........ rules scored against each astronaut's own baseline",
        "router ........ the round trip to Earth decides who acts on a red finding",
      ],
    },
    {
      cmd: "farside --moment",
      out: [
        "same readings, two missions:",
        "  ISS   round trip 0.5 s   -> tier 3: message the flight surgeon",
        "  Mars  round trip 44 min  -> tier 2: crew acts now",
      ],
    },
    {
      cmd: "farside --data",
      out: [
        "NASA OSDR Inspiration4 (OSD-569, OSD-575): pre-flight blood baselines",
        "NASA DONKI: solar particle events, cached",
        "WESAD (Schmidt et al., 2018): wearable stress data, credited, non-commercial use",
      ],
    },
    {
      cmd: "farside --limits",
      out: [
        "decision support, not diagnosis",
        "the 20 s stage test is inspired by the PVT and is not clinically validated",
        "the stress feed replays a held-out WESAD participant, not the person on stage",
      ],
    },
    {
      cmd: "farside --team",
      out: [
        "Team Last Commit, HackAthlone 2026, NASA Space Apps Challenge",
        "Shreya, Om, Ansh, Nandini, Daksh, Diksha",
      ],
    },
  ],
  demoCmd: "farside demo --crew C003",
  demoHint: "press Enter",
};
