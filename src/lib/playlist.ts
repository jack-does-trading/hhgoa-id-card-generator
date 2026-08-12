// Background-music playlist for the splash screen's music player.
//
// This repo doesn't ship any audio — drop your mp3 files into
// `public/audio/` and add one entry per track below. `art` should also be a
// file in `public/` (square image, used as the spinning "disc"); it's fine
// to reuse the same art for every track.
//
// The player renders nothing at all while this array is empty, so it's
// safe to leave it like this until real tracks are ready.
export type Track = {
  title: string;
  artist: string;
  src: string; // e.g. "/audio/track-1.mp3"
  art: string; // e.g. "/audio/track-1.jpg"
};

export const PLAYLIST: Track[] = [
  {
    title: "I Adore You",
    artist: "Hugel ft.Daecolm",
    src: "/audio/I_Adore_You_ft.Daecolm.mp3",
    art: "/audio/one.jpg",
  },
  {
    title: "Take My Mind",
    artist: "WizTheMc ft.Bees Honey",
    src: "/audio/two.mp3",
    art: "/audio/two.png",
  },
  {
    title: "Move",
    artist: "Adam Port ft.Camila Cabello",
    src: "/audio/three.mp3",
    art: "/audio/three.png",
  },
];
