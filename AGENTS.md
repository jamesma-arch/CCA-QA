# Harrow application standards

For current and future Harrow app work, use the CCA QA app's tutorial pattern as the shared design standard: navy text, a gold-bordered guide panel, step progress, English/Thai controls, Previous/Next, Skip/Close and a gold spotlight on the relevant page area. Guidance must be practical and appropriate to the current role and screen. Provide first-use onboarding and an easy way to replay it.

Every tutorial box must be movable with a mouse or touch, offer keyboard movement and Reset position, remain within the visible viewport after resizing, and keep its controls reachable on small screens. Moving, translating or stepping through a guide must preserve form answers and current selections. Keep the position across steps; reset on a fresh guide session. Respect reduced motion and restore focus when closed.

Reuse public/harrow-tutorial.js and public/harrow-tutorial.css rather than creating a different tutorial style. Coordinate contract changes with the mirrored implementation in the CCA QA repository.

Do not publish or deploy changes to Netlify without Jamie's explicit approval for that deployment. A request to build or edit is not permission to deploy.
