BlueSkies
=========

It can be tricky to start getting accuracy landings right. While inexperienced, we tend to make same mistakes over and over again,
especially on an unfamiliar dropzone or in high winds: final legs are often too long or too short, we fly with the wind for too long,
making it impossible to get where we intended to land. One of the reasons for that is the lack of intuition of how canopies behave in strong winds.
If you're in low jump numbers, you haven't really had a chance to develop the intuition yet. That's why we've decided to create
a simple tool to emulate the behaviour of a ram-air canopy, hoping that playing with the tool will help with that to some extent.
Of course, the tool isn't meant to replace proper instruction or real experience, but we hope that it can make the learning process more efficient.

Here is what this tool can be used for:
* Practicing different landing patterns in strong winds.
* Getting an idea of where can you make it back from under your main or reserve.
* Entering the current wind conditions before the jump and getting a rough idea of what to expect under canopy.

The simulation is quite simple and aimed to reflect the experience of skydivers with low jump numbers.
The canopy is assumed to be loaded quite moderately: it has 10 m/s (22.4 mph) horizontal and 5 m/s (11.2 mph) vertical speed with no breaks applied,
zero horizontal and 10 m/s (22.4 mph) vertical speed with breaks fully depressed, 7.5 m/s (16.8 mph) horizontal and 3.0 m/s (6.7 mph) vertical speed
in quarter breaks. We took this numbers from a Russian book on skydiving, and, hopefully, they somewhat resemble the real experience.
At least, the fact that you can go further by applying some breaks when you are upwind seems to be simulated correctly.
All turns are assumed to be flat, that is, slow and with no altitude loss.

The landing pattern is computed assuming an approach with slightly depressed breaks.
The altitudes of the turning points are 300m (985ft), 200m (656ft) and 100m (328ft).

It's also possible to highlight all locations reachable by the canopy from its current position, and all locations from where you can still reach the target.
It can be useful for analysing landing patterns: if the target is close to the bounds of the red area during your approach, the pattern doesn't leave
a loot of room for errors, which is something you don't want.

If you have any suggestions on improving the tool, want us to add a new dropzone or to buy us a beer, feel free to drop an email to boris.jangel [at] gmail [dot] com.
Also, the source code is available on github, and we are more than willing to accept pull requests.

Blue skies!