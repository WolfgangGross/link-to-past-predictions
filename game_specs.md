# A Link to Past Predictions

This is a project to submit to the PriorLabs TabPFN-3.5 Hackathon Sep-Oct 2026.

## The idea

Submit a short browser game to illustrates in a playful pay the capabilities of TabPFN-3.5 and the power and paradox of accurate predictions.

The game style is a 2D top down adventure game like the gameboy game "The Legend of Zelda: A Link to the past.". The player controls a carcter that wakes up at home in the morning and takes decitions and navigate the activities of their daily live. The player can move the charater freely in the world (open world) and interact with charaters and takes decitions. TabPFN takes shape as smartphone the takes the form as a magical artifat the player find in the beginnign of the day next to the bed. 

Theme and story should be the life of a female ML engineer. Getting up. Getting the kids ready for school. Making Breakfast. Dropping the kids at school. making it way to work. Staring the linux computer (runnig omarchy), spinning up claude and takeling new sets of experimentrs involgin TabPFN impovments. Design experiments, contribute to papers, and write the code that turns architectural ideas into trained models - the same people do the research and the engineering, which is why both are good. You'll have significant technical ownership and room to grow as we scale. Scaling transformer architectures from 10K to 1M+ samples - without the structural assumptions that make language models scale. Building multimodal models that combine tabular, text, and numerical understanding. Making models efficient enough for real-world deployment, not just accurate enough for a paper. Designing architectures for time series, forecasting, anomaly detection, and multiple related tables
Day-to-day, you'll design and test novel architectures, run ablations, analyze scaling behavior, and write the training and evaluation infrastructure that makes rapid experimentation possible. We hold software quality to the same standard as research quality.

The paradox of predictions is illustrated with examples like this. 
The deeper pattern is:

  simple rule → prediction → threshold/judgment → tailored action → added coordination and accountability

  Rules such as “always carry an umbrella” are crude but cheap and reliable. A forecast can improve the outcome, but someone must now decide how much
  inconvenience, risk, or error is acceptable.

  Examples from the book:

  - When to leave for the airport.
    Old rule: arrive two hours early.
    Prediction: estimate traffic, security queues, and the actual departure time.
    New problem: choose an acceptable probability of missing the flight. At system level, accurate timing could also undermine airport shops and
    terminals designed around passengers waiting.

  - COVID isolation.
    Old rule: everyone distances, isolates, or stays home.
    Prediction: rapid testing estimates who is infectious.
    New problem: establish false-negative thresholds, testing frequency, sick-pay policies, privacy rules, and who may enter the workplace. The test
    is simple; reorganizing the workplace around it is not.

  - Restaurant inventory—the “AI bullwhip.”
    Old rule: order roughly the same quantity of avocados each week.
    Prediction: vary orders according to predicted demand.
    New problem: the restaurant reduces waste, but its supplier now faces less predictable orders. When many restaurants do this, fluctuations
    propagate through distributors and farms. A locally better decision can make the overall system worse. The authors explain this example in HBR’s
    IdeaCast.

  - Amazon shipping before customers order.
    Old process: shop, order, then ship.
    Prediction: if Amazon becomes sufficiently confident about what you will buy, it could ship first and let you return unwanted items.
    New problem: Amazon must set an accuracy threshold and redesign returns, inventory, payments, and logistics. A sufficiently good prediction
    produces an entirely different business model. The authors’ original thought experiment.

  - Heart-attack triage.
    Old workflow: a clinician follows protocols and orders tests for patients with certain symptoms.
    Prediction: estimate each patient’s heart-attack risk.
    New problem: determine when risk is high enough to test or treat immediately. False negatives can be fatal, while false positives cause costly or
    harmful interventions. If prediction moves into the patient’s home, staffing, liability, and the entire care pathway must change.

  - Home insurance.
    Old model: estimate aggregate risk, charge a premium, and pay after damage.
    Prediction: identify which particular home is likely to develop a leak or suffer another loss.
    New problem: should the insurer merely increase the premium, install sensors, pay for preventive repairs, or refuse coverage? Better prediction
    could transform insurance from compensating losses into preventing them—but introduces monitoring, privacy, and incentive questions. Author Avi
    Goldfarb discusses this example here.

  - Flint’s lead pipes.
    Old approach: excavate geographically or street by street.
    Prediction: rank houses by their likelihood of having lead pipes.
    New problem: should efficiency determine which neighborhoods receive attention first, or should work be distributed visibly and “fairly”?
    Following the predictions initially found lead at about 80% of excavations; political overrides sharply reduced that rate. Better prediction
    exposed—and shifted—political decision-making power.

  - Michael Jordan playing while injured.
    Prediction: doctors estimate the probability of reinjury.
    Judgment: Jordan and the team decide how to value playing now against missing a season or ending his career.
    The prediction cannot supply the answer because the threshold depends on whose preferences count. The book’s publisher figure sampler contains
    this decision tree as well as the umbrella, COVID, Flint, insurance, and emergency-care diagrams.

  - Radiology.
    Prediction: AI interprets a medical image.
    New problem: a radiologist’s job also includes selecting procedures, understanding histories, communicating results, counseling patients,
    handling complications, and coordinating treatment. Automating one prediction does not automatically simplify the surrounding job; it
    redistributes tasks and responsibility.

  The strongest lesson is that prediction often does not remove judgment—it makes previously hidden judgment explicit. Every probability needs a
  threshold, and every threshold encodes someone’s preferences:

  - How bad is a false negative?
  - How costly is a false positive?
  - Who bears those costs?
  - Who has authority to choose?
  - Which surrounding processes relied on the old rule?


Not quite sure how these find place in the story, and we don't need to stick to these exampels. Be creative. 


TabPFN can be used via an API, and I share my API key in the .env as TABPFN_API_KEY. 

Deploy via vercel.
