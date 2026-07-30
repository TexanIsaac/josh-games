# Credits

**Zombie Noobs** was designed by **Josh Alexander**. The game idea, the two sides,
the ranks and the way you switch between them are all his.

## Sound effects

Tones are generated in the browser with **ZzFX** by Frank Force, used under the MIT
licence. The notice is kept in the source next to the code it applies to.

https://github.com/KilledByAPixel/ZzFX

## Music

All six tracks are real recordings, three Allied and three Axis. Every one of them
was taken from Wikimedia Commons and every one is in the public domain there. The
licence shown on each file page was checked before it was downloaded, and the
download script refuses to save anything not marked public domain.

Each was converted to mono MP3 at 72 to 80 kbps, purely so that Safari on an iPad
will play it: Safari does not decode Ogg Vorbis, which is the format most of these
are stored in. Nothing was edited, cut or remixed.

| Track | File | Recording | Why it is free |
|---|---|---|---|
| Soviet Anthem | `anthem-1977.mp3` | Red Army Choir, 7 October 1977 | Not an object of copyright under article 1259 of Book IV of the Civil Code of the Russian Federation, which excludes USSR state symbols |
| Star-Spangled Banner | `anthem-usa.mp3` | United States Navy Band | Public domain: a work of the US federal government |
| La Marseillaise | `anthem-france.mp3` | 1907 recording | Public domain by age |
| Deutschlandlied | `anthem-germany.mp3` | USAREUR Band | Public domain: a work of the US federal government |
| Kimigayo | `anthem-japan.mp3` | Toyama Army School Military Band, 1930 | Public domain by age |
| Marcia Reale | `anthem-italy.mp3` | Composed by Giuseppe Gabetti, 1796 to 1862 | Public domain by age |

Composers, for the record: Alexandrov (Soviet), John Stafford Smith (the
Star-Spangled Banner tune), Rouget de Lisle (Marseillaise), Haydn (the
Deutschlandlied tune), Hayashi Hiromori (Kimigayo), Gabetti (Marcia Reale). All six
compositions are long out of copyright independently of the recordings.

**One condition worth writing down.** The Commons page for the Soviet recording
notes that it may be reused in its entirety and warns that taking only a portion of
it may not be covered. So the game loops the whole recording and never a clipped
excerpt. Source page:
https://commons.wikimedia.org/wiki/File:Gimn_Sovetskogo_Soyuza_(1977_Short_Vocal).oga

**Deliberately not included:** the Nazi party song. It is propaganda rather than a
state anthem, it is banned in Germany, and it has no place in a child's game. The
German track is Haydn's melody as played by a US Army band, which is the national
anthem and nothing else. One Commons file pairs the anthem with the party song; that
file was avoided for exactly this reason.

If any of these files is missing, that track falls back to a synthesised arrangement
of the same melody, so the music never simply stops. That is also what happens if the
game is opened straight off the disk without the `assets` folder beside it.
