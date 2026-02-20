import { Module } from './types'

export const modules: Module[] = [
  {
    slug: 'foundations',
    title: 'Statistical Foundations',
    description: 'Core concepts in statistics that power every data science decision',
    weekRange: 'Week 1-2',
    lessons: [
      {
        slug: 'sampling-variance',
        title: 'Sampling, Variance & Standard Error',
        description: 'Understand why sample statistics vary and how to quantify uncertainty',
        estimatedMinutes: 15,
        blocks: [
          {
            type: 'text',
            content: `## Why Sampling Matters

In product data science, you rarely measure *everyone*. Instead, you work with samples—a subset of users, events, or transactions.

**The challenge:** Different samples give different results. If you measure conversion rate from 100 users today, it might be 12%. Tomorrow's 100 users might show 14%. Neither is "wrong"—they're both estimates of the true underlying rate.

**Key insight:** Understanding *how much* sample statistics vary is the foundation of every A/B test, confidence interval, and statistical claim you'll make.`
          },
          {
            type: 'quickcheck',
            id: 'qc1',
            statement: 'If you run the same experiment twice with different random samples, you should expect to get the exact same results.',
            isTrue: false,
            explanation: 'Different samples will produce different results due to random variation. This is called sampling variability and is completely expected.'
          },
          {
            type: 'text',
            content: `## The Three Key Concepts

### 1. Population vs Sample
- **Population**: All possible observations (e.g., all users who could ever visit your site)
- **Sample**: The observations you actually measure (e.g., the 10,000 users in your A/B test)

### 2. Variance
Variance measures how spread out values are around their mean. High variance = values are scattered. Low variance = values cluster tightly.

For a proportion (like conversion rate), variance depends on the true rate:
\`\`\`
Variance of proportion = p × (1-p)
\`\`\`
- Maximum variance at p = 0.5 (most uncertainty)
- Minimum variance near p = 0 or p = 1

### 3. Standard Error
Standard error tells you how much your *sample statistic* varies from sample to sample:

\`\`\`
SE = √(p × (1-p) / n)
\`\`\`

Where:
- **p** = true proportion
- **n** = sample size

**Critical insight:** Standard error shrinks as sample size grows—but only by the square root! To cut SE in half, you need 4× the sample size.`
          },
          {
            type: 'flashcards',
            id: 'fc1',
            cards: [
              {
                front: 'What is Standard Error?',
                back: 'The standard deviation of a sample statistic. It measures how much the statistic would vary across repeated samples.'
              },
              {
                front: 'How does sample size affect Standard Error?',
                back: 'SE decreases with the square root of sample size. 4× the sample = ½ the SE.'
              },
              {
                front: 'At what proportion is variance maximized?',
                back: 'At p = 0.5 (50%). Variance = 0.5 × 0.5 = 0.25'
              },
              {
                front: 'What\'s the formula for SE of a proportion?',
                back: 'SE = √(p(1-p)/n) where p is the proportion and n is sample size'
              }
            ]
          },
          {
            type: 'microsim',
            id: 'sim1',
            simType: 'sampling-distribution',
            title: 'Sampling Distribution Explorer',
            description: 'See how sample proportions vary across repeated samples. Adjust the true rate and sample size to build intuition.'
          },
          {
            type: 'quiz',
            id: 'quiz1',
            question: 'You\'re running an A/B test with a baseline conversion rate of 10%. You want to reduce your standard error by half. What should you do?',
            multiSelect: false,
            options: [
              { id: 'a', text: 'Double your sample size', isCorrect: false },
              { id: 'b', text: 'Quadruple your sample size', isCorrect: true },
              { id: 'c', text: 'Run the test for twice as long', isCorrect: false },
              { id: 'd', text: 'Use a different baseline rate', isCorrect: false }
            ],
            explanation: 'Since SE = √(p(1-p)/n), to halve SE you need to quadruple n. Doubling n only reduces SE by about 29%.'
          },
          {
            type: 'memo',
            id: 'memo1',
            prompt: 'Decision Memo: When would you need to increase your sample size in a real A/B test? What are the trade-offs?'
          }
        ]
      },
      {
        slug: 'confidence-intervals',
        title: 'Confidence Intervals Intuition',
        description: 'Learn what confidence intervals really mean and how to use them',
        estimatedMinutes: 12,
        blocks: [
          {
            type: 'text',
            content: `## What Confidence Intervals Actually Mean

A confidence interval (CI) is a range of plausible values for an unknown parameter. But what does "95% confidence" actually mean?

**Common misconception:** "There's a 95% chance the true value is in this interval."

**Correct interpretation:** If we repeated this experiment many times and calculated a CI each time, about 95% of those intervals would contain the true value.

The true value either IS or ISN'T in your interval—it's not probabilistic. The confidence is about the *procedure*, not this specific interval.`
          },
          {
            type: 'quickcheck',
            id: 'qc-ci1',
            statement: 'A 95% confidence interval means there is a 95% probability that the true parameter is within the interval.',
            isTrue: false,
            explanation: 'The true value is fixed—either it\'s in the interval or not. The 95% refers to the long-run behavior of the procedure: 95% of intervals calculated this way will capture the true value.'
          },
          {
            type: 'text',
            content: `## Building a Confidence Interval

For a proportion, the 95% CI formula is:

\`\`\`
p̂ ± 1.96 × SE
\`\`\`

Where:
- **p̂** = your sample proportion
- **SE** = √(p̂(1-p̂)/n)
- **1.96** = the z-score for 95% confidence

### Example
Your A/B test shows a 12% conversion rate (p̂ = 0.12) with n = 1,000 users.

\`\`\`
SE = √(0.12 × 0.88 / 1000) = 0.0103
95% CI = 0.12 ± 1.96 × 0.0103
       = 0.12 ± 0.020
       = [0.100, 0.140] or [10.0%, 14.0%]
\`\`\`

You can be reasonably confident the true conversion rate is between 10% and 14%.`
          },
          {
            type: 'microsim',
            id: 'sim-ci',
            simType: 'confidence-interval',
            title: 'Confidence Interval Coverage',
            description: 'Watch as we generate many confidence intervals. See how often they capture the true value.'
          },
          {
            type: 'quickcheck',
            id: 'qc-ci2',
            statement: 'A wider confidence interval indicates more precision in your estimate.',
            isTrue: false,
            explanation: 'Wider intervals mean LESS precision. You\'re less certain where the true value lies. Narrower intervals (achieved with larger samples) are more precise.'
          },
          {
            type: 'flashcards',
            id: 'fc-ci',
            cards: [
              {
                front: 'What z-score is used for a 95% CI?',
                back: '1.96 (approximately 2 standard errors)'
              },
              {
                front: 'What z-score for 99% CI?',
                back: '2.576'
              },
              {
                front: 'How do you narrow a confidence interval?',
                back: 'Increase sample size (reduces SE) or accept lower confidence level'
              },
              {
                front: 'What does "coverage" mean for CIs?',
                back: 'The proportion of CIs that contain the true parameter across many experiments'
              }
            ]
          },
          {
            type: 'quiz',
            id: 'quiz-ci',
            question: 'Your A/B test shows the treatment group has a 15% conversion rate (CI: 12%-18%) and control has 10% (CI: 7%-13%). The CIs overlap. What can you conclude?',
            multiSelect: false,
            options: [
              { id: 'a', text: 'The difference is definitely not significant', isCorrect: false },
              { id: 'b', text: 'The difference is definitely significant', isCorrect: false },
              { id: 'c', text: 'You need to look at the CI of the difference, not individual CIs', isCorrect: true },
              { id: 'd', text: 'The experiment failed', isCorrect: false }
            ],
            explanation: 'Overlapping individual CIs don\'t directly tell you about significance. You need to compute the CI of the DIFFERENCE between groups. The difference could still be significant even with some overlap.'
          },
          {
            type: 'memo',
            id: 'memo-ci',
            prompt: 'Decision Memo: How would you explain a confidence interval to a non-technical stakeholder? What\'s the key insight you\'d emphasize?'
          }
        ]
      },
      {
        slug: 'hypothesis-testing',
        title: 'Hypothesis Testing & P-Values',
        description: 'Master the logic of hypothesis tests and what p-values really tell you',
        estimatedMinutes: 18,
        blocks: [
          {
            type: 'text',
            content: `## The Logic of Hypothesis Testing

Hypothesis testing follows a specific logical structure:

1. **Assume nothing changed** (null hypothesis H₀)
2. **Calculate how surprising your data would be** under that assumption
3. **If very surprising**, reject the null hypothesis

### The Null Hypothesis

For A/B tests, H₀ is typically: "There is no difference between treatment and control."

We're asking: "If the treatment had zero effect, how likely are we to see results this extreme (or more extreme) just by random chance?"

### P-Values

The p-value answers: **"Given the null hypothesis is true, what's the probability of seeing data at least as extreme as what we observed?"**

**Not:** "What's the probability the null hypothesis is true?" (This is a common mistake!)

A small p-value (typically < 0.05) means:
- Either the null hypothesis is false, OR
- Something rare happened by chance`
          },
          {
            type: 'quickcheck',
            id: 'qc-ht1',
            statement: 'A p-value of 0.03 means there\'s a 3% chance that the null hypothesis is true.',
            isTrue: false,
            explanation: 'P-values don\'t tell you the probability the null is true. A p-value of 0.03 means: IF the null were true, there\'s a 3% chance of seeing results this extreme. The null is either true or false—not probabilistic.'
          },
          {
            type: 'text',
            content: `## The Two Types of Errors

| | H₀ True (No Effect) | H₀ False (Real Effect) |
|---|---|---|
| **Reject H₀** | Type I Error (False Positive) | Correct! |
| **Fail to Reject** | Correct | Type II Error (False Negative) |

### Key Terms

- **α (alpha)**: The threshold for rejecting H₀ (typically 0.05). This is your false positive rate.
- **β (beta)**: The probability of failing to detect a real effect.
- **Power = 1 - β**: The probability of detecting a real effect when it exists.

### The Trade-offs

- Lower α → Fewer false positives, but more false negatives
- Higher power → Fewer false negatives, but requires larger samples
- You can't eliminate both error types—you have to balance them`
          },
          {
            type: 'flashcards',
            id: 'fc-ht',
            cards: [
              {
                front: 'What is a Type I error?',
                back: 'False Positive: Rejecting H₀ when it\'s actually true. Saying there\'s an effect when there isn\'t.'
              },
              {
                front: 'What is a Type II error?',
                back: 'False Negative: Failing to reject H₀ when it\'s actually false. Missing a real effect.'
              },
              {
                front: 'What is statistical power?',
                back: 'Power = 1 - β. The probability of correctly detecting a true effect. Typically we aim for 80% power.'
              },
              {
                front: 'What does p < 0.05 mean?',
                back: 'If the null hypothesis were true, there would be less than 5% chance of seeing data this extreme or more extreme.'
              },
              {
                front: 'Why is "failing to reject H₀" different from "accepting H₀"?',
                back: 'Absence of evidence isn\'t evidence of absence. A non-significant result might mean no effect exists, OR your test lacked power to detect it.'
              }
            ]
          },
          {
            type: 'quiz',
            id: 'quiz-ht1',
            question: 'You\'re running an A/B test and get p = 0.08. Your company uses α = 0.05. What should you conclude?',
            multiSelect: false,
            options: [
              { id: 'a', text: 'The treatment definitely has no effect', isCorrect: false },
              { id: 'b', text: 'The treatment probably has no effect', isCorrect: false },
              { id: 'c', text: 'We don\'t have sufficient evidence to reject the null hypothesis', isCorrect: true },
              { id: 'd', text: 'We should lower α to 0.10 so the result is significant', isCorrect: false }
            ],
            explanation: 'We "fail to reject" H₀, but that\'s NOT the same as proving no effect. The effect might exist but be too small to detect with our sample size. And we should never change α after seeing results—that\'s p-hacking!'
          },
          {
            type: 'text',
            content: `## Practical Significance vs Statistical Significance

Just because a result is statistically significant doesn't mean it matters.

**Example:** With millions of users, you might detect a 0.01% conversion rate increase with p < 0.001. Statistically significant? Yes. Worth the engineering effort? Probably not.

### Always Ask:
1. Is the effect statistically significant? (p < α)
2. Is the effect practically significant? (Does the magnitude matter?)
3. What's the confidence interval? (Range of plausible effect sizes)

**Rule of thumb:** If the CI includes effect sizes that are both meaningful and meaningless, you need more data to decide.`
          },
          {
            type: 'quiz',
            id: 'quiz-ht2',
            question: 'Which of these are signs of a well-designed A/B test? (Select all that apply)',
            multiSelect: true,
            options: [
              { id: 'a', text: 'Sample size calculated before running the test', isCorrect: true },
              { id: 'b', text: 'α level chosen after seeing results', isCorrect: false },
              { id: 'c', text: 'Minimum detectable effect defined upfront', isCorrect: true },
              { id: 'd', text: 'Test stopped early when results look significant', isCorrect: false }
            ],
            explanation: 'Good tests define sample size, MDE, and α BEFORE running. Changing these after seeing results, or stopping early, inflates false positive rates (p-hacking).'
          },
          {
            type: 'memo',
            id: 'memo-ht',
            prompt: 'Decision Memo: Describe a scenario where you would use α = 0.01 instead of α = 0.05. What about a scenario where you might accept α = 0.10?'
          }
        ]
      }
    ]
  },
  {
    slug: 'experimentation',
    title: 'Experimentation & A/B Testing',
    description: 'Design, analyze, and interpret experiments that drive decisions',
    weekRange: 'Week 3-4',
    lessons: []
  },
  {
    slug: 'metrics',
    title: 'Product Metrics & KPIs',
    description: 'Choose and define metrics that align with business goals',
    weekRange: 'Week 5-6',
    lessons: []
  },
  {
    slug: 'causal-inference',
    title: 'Causal Inference',
    description: 'Go beyond correlation to understand cause and effect',
    weekRange: 'Week 7-8',
    lessons: []
  },
  {
    slug: 'ml-for-product',
    title: 'ML for Product',
    description: 'Apply machine learning to product problems',
    weekRange: 'Week 9-11',
    lessons: []
  },
  {
    slug: 'communication',
    title: 'Data Communication',
    description: 'Tell compelling stories with data',
    weekRange: 'Week 12-13',
    lessons: []
  },
  {
    slug: 'advanced-topics',
    title: 'Advanced Topics',
    description: 'Bayesian methods, multi-armed bandits, and more',
    weekRange: 'Week 14-16',
    lessons: []
  }
]

export function getModule(slug: string): Module | undefined {
  return modules.find(m => m.slug === slug)
}

export function getLesson(moduleSlug: string, lessonSlug: string) {
  const mod = getModule(moduleSlug)
  if (!mod) return undefined
  const lesson = mod.lessons.find(l => l.slug === lessonSlug)
  return lesson ? { module: mod, lesson } : undefined
}

export function getTotalLessonCount(): number {
  return modules.reduce((acc, m) => acc + m.lessons.length, 0)
}

export function getNextLesson(moduleSlug: string, lessonSlug: string): { module: Module; lesson: typeof modules[0]['lessons'][0] } | null {
  const moduleIndex = modules.findIndex(m => m.slug === moduleSlug)
  if (moduleIndex === -1) return null

  const currentMod = modules[moduleIndex]
  const lessonIndex = currentMod.lessons.findIndex(l => l.slug === lessonSlug)
  if (lessonIndex === -1) return null

  // Next lesson in same module?
  if (lessonIndex < currentMod.lessons.length - 1) {
    return { module: currentMod, lesson: currentMod.lessons[lessonIndex + 1] }
  }

  // First lesson of next module with lessons?
  for (let i = moduleIndex + 1; i < modules.length; i++) {
    if (modules[i].lessons.length > 0) {
      return { module: modules[i], lesson: modules[i].lessons[0] }
    }
  }

  return null
}

export function getPreviousLesson(moduleSlug: string, lessonSlug: string): { module: Module; lesson: typeof modules[0]['lessons'][0] } | null {
  const moduleIndex = modules.findIndex(m => m.slug === moduleSlug)
  if (moduleIndex === -1) return null

  const currentMod = modules[moduleIndex]
  const lessonIndex = currentMod.lessons.findIndex(l => l.slug === lessonSlug)
  if (lessonIndex === -1) return null

  // Previous lesson in same module?
  if (lessonIndex > 0) {
    return { module: currentMod, lesson: currentMod.lessons[lessonIndex - 1] }
  }

  // Last lesson of previous module with lessons?
  for (let i = moduleIndex - 1; i >= 0; i--) {
    if (modules[i].lessons.length > 0) {
      const prevMod = modules[i]
      return { module: prevMod, lesson: prevMod.lessons[prevMod.lessons.length - 1] }
    }
  }

  return null
}
