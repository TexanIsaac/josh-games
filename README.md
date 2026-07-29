# Zombie Noobs

**A game by Josh Alexander.**

Play it here: https://texanisaac.github.io/josh-games/

You start as a noob with nothing but your fists and you fight zombies. Every
zombie you take down moves you up a rank. Get bitten too many times and you turn
into a zombie yourself, and then you are the one biting noobs.

## Ranks

Josh's numbers, on both sides:

| Kills | Noob side | Zombie side |
|------:|-----------|-------------|
| 0 | Noob (fists) | Zombie (bite) |
| 7 | Noob Knifer (knife) | Zombie Ripper (claws) |
| 22 | Noob Gunner (pistol) | Zombie Spitter (spits acid) |
| 37 | Noob Rioter (riot shield) | Zombie Brute (smash) |

Getting bitten fills up an infection bar. Fill it and you switch to the zombie
side, where you keep your own separate rank. As a zombie your bite turns noobs
into zombies who then fight for you. Get taken down as a zombie and you are back
with the noobs. There is no game over, you just keep going back and forth.

Clear a wave and you pick one of three upgrades. They stack forever.

## How to play

Steer with your thumb on the left half of the screen. That is the only control.
You swing on your own whenever something is close enough, so you never have to
aim.

## How to change it

Everything worth changing sits at the top of `index.html`.

`TUNE` is a list of named numbers. Change one, save, refresh.

```js
KILLS_FOR_KNIFER: 7,
PLAYER_SPEED: 205,
BITE_PER_HIT: 26,
```

`MAP` is the level, drawn with keyboard characters:

```
#  wall          C  crate
.  floor         P  where you start
Z  where zombies come from
```

Rows do not have to be the same length. The game squares it up, seals the outside
edge, and fills in any room that got walled off by accident, so you cannot draw a
map that breaks the game.

`UPGRADES` is the list of cards you pick between waves. Copy a line to add one.

If something does go wrong, the game shows you the problem in plain words instead
of going blank.

## Running it on your own computer

```
py -3.12 serve.py
```

Then open the address it prints. Any phone or tablet on the same wifi can open
that same address.

`build-artifact.py` regenerates the hosted copy from `index.html`. `index.html` is
always the real file, so that is the one to edit.
