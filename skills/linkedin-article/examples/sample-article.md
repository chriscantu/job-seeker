# Example: Full Article

> This article was produced for the "Fat Marker / Agentic Development" topic.
> It demonstrates: data-backed thesis, Design Thinking + Shape Up frameworks,
> personal experience (Vrbo/Shape Up), voice-audited writing, inline references,
> and embedded images with attribution.

---

# Pick Up a Fat Marker Before You Pick Up an AI Agent

*Agentic development is accelerating the wrong part of product development.*

## The speed trap

We can go from idea to working code in minutes now. That's genuinely remarkable. But there's a pattern emerging that should give us pause: teams are building solutions faster than they can articulate the problem.

Here's the thing — we were already bad at this. [Pendo's analysis of 615 software products](https://www.pendo.io/resources/the-2019-feature-adoption-report/) found that 80% of features are rarely or never used. Only 12% of features generate 80% of actual daily usage. We've been building the wrong things for years. The bottleneck was never "how fast can we code it?" — it was "do we understand the problem well enough to build the right thing?"

Agentic development doesn't fix that gap. It widens it.

When building was slow and expensive, the cost of implementation acted as a natural checkpoint. Teams were forced to justify what they were about to spend weeks building. That friction wasn't waste — it was thinking time. Agentic development removes it. The cost of building the wrong thing dropped from weeks to minutes. So we build the wrong thing more often, and nobody notices because it felt productive.

## Start with the human, not the tool

Tim Brown wrote in [*Change by Design*](https://www.ideo.com/journal/change-by-design) that the first job of design thinking is empathy — stepping into the user's world to understand what they actually need, not what we assume they need. The process is deliberate: observe, define, ideate, prototype, test. Each step exists because our first understanding of a problem is almost always incomplete.

That process feels slow in a world where an AI agent can produce a working prototype before we've finished the problem statement. But slowness isn't the enemy. Building the wrong thing is.

![Design Council Double Diamond](images/double-diamond.png)
*Double Diamond, Design Council, CC BY 4.0*

The Double Diamond captures this visually. The first diamond is about the *problem* — diverge to discover what's really going on, then converge to define the right problem to solve. The second diamond is about the *solution* — diverge to explore options, then converge to deliver. Most teams jump straight to the second diamond. Agentic development makes that skip even easier.

The question design thinking forces us to answer isn't "what should we build?" — it's "what problem are we actually solving, and for whom?" Those sound like the same question. They're not. The first one jumps to solutions. The second one stays with the human.

## Fat Marker sketches: a forcing function for clarity

[Basecamp's Shape Up](https://basecamp.com/shapeup/1.3-chapter-04) methodology has a technique we've used on our teams called a Fat Marker sketch. The idea is simple: sketch your solution with a marker so thick you *can't* add detail. You're forced to capture only the essential shape — what's in, what's out, what "done" looks like at the highest level.

![Fat Marker sketch example](images/fat-marker-sketch-1.png)
*From [Shape Up](https://basecamp.com/shapeup/1.3-chapter-04) by Ryan Singer, Basecamp*

The reason this matters is that teams too easily skip to the wrong level of detail. We've all been in the meeting where someone is debating button placement before anyone has agreed on what the feature actually does. A fat marker prevents that. It keeps the conversation at the altitude where the important decisions live: boundaries, trade-offs, and scope.

When we adopted Shape Up at Vrbo, this was one of the hardest shifts — getting teams comfortable with ambiguity at the shaping stage. Engineers in particular wanted specificity. But the discipline of staying rough early meant that by the time we handed work to teams, the *problem* was well-defined even if the *solution* was still open. Teams had room to make good decisions because we'd done the thinking about what mattered and what didn't.

That same discipline applies directly to working with AI agents. Before handing a problem to an agent, we should be able to sketch the solution in broad strokes on a whiteboard. Three questions:

1. What is the core user problem — not the symptom, the root cause?
2. What are the boundaries — what's in and what's out?
3. What does "done" look like at the highest level?

If we can answer those with a fat marker, we've done the hard work. The AI agent can do what it's actually good at: turning a well-understood solution into working code, fast.

If we can't answer them, no amount of speed will save us.

## The real risk at scale

The risk isn't that agentic development makes us worse engineers. It's that we get very good at building and out of practice at thinking about *what to build*. Those are different muscles. The second one is the one that compounds.

This matters more as organizations grow. A single developer building the wrong prototype wastes minutes. A team of sixty building the wrong feature wastes months — and the rework isn't just code. It's user research that needs to be redone, roadmap credibility that erodes, and trust between product and engineering that frays.

The teams that get the most out of AI agents won't be the fastest shippers. They'll be the ones that protect the thinking — who treat problem definition as the bottleneck worth investing in, not an obstacle between them and a prototype.

## Where we go from here

We're still figuring out what good process looks like when building is nearly free. But a few things seem clear:

Whether we call it design thinking, first principles, or just good product discipline, the work hasn't changed: understand the root problem before we start solving it. The tools got faster. The fundamentals didn't.

Pick up a fat marker before you pick up an AI agent.

---

*Sources:*
- *[Pendo Feature Adoption Report](https://www.pendo.io/resources/the-2019-feature-adoption-report/) (615 products analyzed) — 80% of features rarely or never used*
- *Tim Brown, [Change by Design](https://www.ideo.com/journal/change-by-design) (2009) — design thinking and empathy-first product development*
- *Basecamp, [Shape Up — Chapter 4: Find the Elements](https://basecamp.com/shapeup/1.3-chapter-04) — Fat Marker sketches and shaping at the right level of abstraction*
