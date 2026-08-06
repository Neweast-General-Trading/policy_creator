import type { StoredPolicy } from "./workflow-types.js";

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPolicyContext(policy: StoredPolicy) {
  const header = [
    `Policy: ${policy.name}`,
    `Company: ${policy.companyName}`,
    `Department: ${policy.departmentName}`,
    `Version: ${policy.version}`,
    `Status: ${policy.status}`,
  ].join("\n");

  const sections = policy.sections
    .map((section, index) => {
      const text = stripHtml(section.content);
      if (!text) return "";
      return `${index + 1}. ${section.title}\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `${header}\n\n${sections}`.slice(0, 12000);
}

function findRelevantExcerpt(context: string, question: string) {
  const sentences = context.split(/(?<=[.!?])\s+/);
  const terms = question
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3);

  const ranked = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (lower.includes(term) ? 1 : 0),
        0,
      );
      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.sentence);

  return ranked.join(" ");
}

async function askOpenAi(question: string, context: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a policy assistant. Answer only from the provided policy text. If the answer is not in the policy, say you cannot find it in this document. Keep answers concise.",
        },
        {
          role: "user",
          content: `Policy document:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenAI request failed: ${payload.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || null;
}

export async function answerPolicyQuestion(policy: StoredPolicy, question: string) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Question is required");
  }

  const context = buildPolicyContext(policy);
  const aiAnswer = await askOpenAi(trimmedQuestion, context);
  if (aiAnswer) {
    return {
      answer: aiAnswer,
      source: "openai" as const,
    };
  }

  const excerpt = findRelevantExcerpt(context, trimmedQuestion);
  if (excerpt) {
    return {
      answer: `Based on this policy document: ${excerpt}`,
      source: "local" as const,
    };
  }

  return {
    answer:
      "I could not find a direct answer in this policy. Try asking about a specific section, requirement, or responsibility mentioned in the document.",
    source: "local" as const,
  };
}
