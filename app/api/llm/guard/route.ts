import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { sessionTime, focusedTime, violations, focusRate } = await request.json()

    // Generate roast message using Cerebras API
    let roastMessage = "Really? Already? Time to get serious about your goals!"
    
    try {
      const cerebrasResponse = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer csk-96hc22m8fvpx4w8k55drne86r5pvm4wcpce9thhenecpy339`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a motivational study coach. The user just lost focus during their study session. They've been studying for ${Math.floor(sessionTime / 60)} minutes with ${focusRate}% focus rate and ${violations} distractions. 

Give them a short, motivating message to get them back on track. Be encouraging but firm. Keep it under 100 characters and avoid emojis. Focus on motivation and getting back to work.`
            },
            {
              role: "user",
              content: "I just lost focus and got distracted during my study session."
            }
          ],
          model: "llama-4-scout-17b-16e-instruct",
          max_completion_tokens: 100,
          temperature: 0.8,
          top_p: 0.9,
          stream: false
        }),
      })

      if (cerebrasResponse.ok) {
        const data = await cerebrasResponse.json()
        roastMessage = data.choices?.[0]?.message?.content || roastMessage
      }
    } catch (apiError) {
      console.error("Cerebras API error:", apiError)
      // Use fallback roast messages
      const fallbackRoasts = [
        "Really? Already? Your attention span is shorter than a goldfish's memory!",
        "Come on! You couldn't even focus for 2 seconds? Time to get serious!",
        "Distraction detected! Your future self will thank you for staying focused.",
        "Focus slipping? Remember why you started this session!",
        "That was quick! Ready to dive back into deep work?",
      ]
      roastMessage = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)]
    }

    return NextResponse.json({ message: roastMessage })
  } catch (error) {
    console.error("Error in LLM guard API:", error)
    return NextResponse.json({ error: "Failed to generate roast message" }, { status: 500 })
  }
}

interface SessionEvaluation {
  goalMinutes: number
  elapsedSeconds: number
  violations: number
  reflection: string
  checklistComplete: boolean
  focusPercentage: number
}

function evaluateSession(data: SessionEvaluation) {
  const { goalMinutes, elapsedSeconds, violations, reflection, checklistComplete, focusPercentage } = data

  const elapsedMinutes = elapsedSeconds / 60
  const timeGoalPercentage = (elapsedMinutes / goalMinutes) * 100
  const reflectionBullets = reflection.split("\n").filter((line) => line.trim().length > 10).length
  const reflectionWords = reflection.trim().split(/\s+/).length

  // Evaluation criteria
  const timeGoalMet = timeGoalPercentage >= 80
  const goodReflection = reflectionBullets >= 3 && reflectionWords >= 30
  const excellentFocus = focusPercentage >= 85
  const decentFocus = focusPercentage >= 60
  const lowViolations = violations <= 3

  // Decision logic
  let allow = false
  let feedback = ""
  let roast = ""

  if (timeGoalMet && decentFocus && lowViolations) {
    allow = true
    feedback = `Excellent! You completed ${Math.round(timeGoalPercentage)}% of your time goal with ${focusPercentage}% focus. Well done!`
  } else if (goodReflection && decentFocus) {
    allow = true
    feedback =
      "Great reflection! You've clearly thought about your learning process. Your detailed insights show real engagement with the material."
  } else if (checklistComplete && excellentFocus) {
    allow = true
    feedback = "Outstanding focus and task completion! You've demonstrated excellent self-discipline and productivity."
  } else {
    // Provide specific feedback on what's missing
    const issues = []

    if (timeGoalPercentage < 50) {
      issues.push(`only ${Math.round(timeGoalPercentage)}% of your time goal`)
    }

    if (focusPercentage < 60) {
      issues.push(`low focus rate (${focusPercentage}%)`)
    }

    if (violations > 5) {
      issues.push(`too many distractions (${violations} violations)`)
    }

    if (reflectionWords < 20) {
      issues.push("insufficient reflection detail")
    }

    if (issues.length > 0) {
      feedback = `Not quite ready to end: ${issues.join(", ")}. `
    }

    if (reflectionBullets < 3) {
      feedback += "Please provide at least 3 detailed points about what you learned or accomplished."
      roast = "Come on, give me more than that! What did you actually learn or struggle with?"
    } else if (timeGoalPercentage < 30) {
      feedback += "You've barely started! Try to reach at least 50% of your time goal."
      roast = "That was quick! Are you sure you gave it your best effort?"
    } else if (focusPercentage < 40) {
      feedback += "Your focus was quite scattered. What kept distracting you?"
      roast = "Looks like your attention was everywhere except your work!"
    } else {
      feedback += "You're close! Just need a bit more effort or reflection."
      roast = "Almost there! Don't give up when you're so close to the finish line."
    }
  }

  return { allow, feedback, roast }
}
