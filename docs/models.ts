import {
  defineModel,
  section,
  hasMany,
  belongsTo,
  AstQuery,
  z,
} from "contentbase";
import { toString } from "mdast-util-to-string";

/** 
 * A Model simply defines which subfolder of docs a type of document lives in.
 * 
 * For each of those documents in those folder, we expect that they will adhere to what the model specifies:
 * 
 * 1) YAML Frontmatter schemas.  These can be validated by `cnotes validate` 
 * 2) Sections.  These are the headings and content underneath them.  They can be extracted and validated by `cnotes extract`
 *
*/
export const Report = defineModel("Report", {
	prefix: "reports",
	description: "Reports are research artifacts. They start as a research plan (planning), get approved, then researched and synthesized. Reports can link to sub-reports for parallel or deep-dive investigations.",
	meta: z.object({
		goal: z.string().optional().describe("Slug of the goal this report is aligned to"),
		tags: z.array(z.string()).default([]).describe("Arbitrary tags for categorizing the report"),
		status: z.enum(["planning", "approved", "researching", "synthesizing", "complete", "stale"]).default("planning").describe("planning = draft research plan awaiting approval. approved = green-lit to execute. researching = actively being investigated. synthesizing = findings collected, writing up conclusions. complete = final. stale = outdated, may need refresh."),
		relatedReports: z.array(z.string()).default([]).describe("Slugs of related or sub-reports (e.g. deep-dives spawned from this report)"),
	}),
	sections: {
		researchPlan: section("Research Plan", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().optional().describe("What we're researching, why, what questions to answer, what to search for, scope boundaries."),
		}),
		findings: section("Findings", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().optional().describe("Raw findings, sources, evidence collected during research."),
		}),
		synthesis: section("Synthesis", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().optional().describe("Distilled conclusions, recommendations, and actionable insights."),
		}),
	},
});

export const Idea = defineModel("Idea", {
	prefix: "ideas",
	description: "An idea is something that is aligned to a Goal, and can eventually become a Project/Plans for our Agents to work on", 
	meta: z.object({
		goal: z.string().optional().describe("Slug of the goal this idea is aligned to"),
		tags: z.array(z.string()).default([]).describe("Arbitrary tags for categorizing the idea"),
		status: z.enum(["spark", "exploring", "ready", "parked", "promoted"]).default("exploring").describe("spark is a new raw idea, exploring means actively researching already so nothing to do until otherwise changed. Ready means developed enough to be promoted into a Project.  Promoted means it already has been turned into a project. "),
	}),
	relationships: {
		goal: belongsTo(() => Goal, {
			foreignKey: (doc: any) => doc.meta.goal as string,
		}),
	},
});

export const Goal = defineModel("Goal", {
  prefix: "goals",
  meta: z.object({
    horizon: z.enum(["short", "medium", "long"]).default("medium").describe("The horizon of the goal, short is less than 3 months, medium is 3-6 months, long is more than 6 months"),
  }),
	sections: {
		successCriteria: section("Success Criteria", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().min(1).describe("Each goal should have a section that defines what success lookss like."),
		}),
		motivation: section("Motivation", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().min(1).describe("Each goal should have a section that defines the motivation for the goal."),
		}),
	}
});

export const Play = defineModel("Play", {
	prefix: "plays",
	description: "Plays are repeatable, schedulable prompts executed by the agentic loop on a defined schedule.",
	meta: z.object({
		agent: z.string().describe("The agent that is responsible for the play.").default("claude"),
		tags: z.array(z.string()).describe("Tags for categorizing the play").optional(),
		schedule: z.string().describe("format is a WIP, dont want to use CRON, for now: daily, hourly, weekly, 4pm, every-half-hour, beginning-of-day, end-of-day").default("every-half-hour"),
		lastRanAt: z.number().optional().describe('Timestamp for when this play last ran'),
		running: z.boolean().optional().default(false).describe('Set to true while the play is actively being executed by the scheduler. Prevents double execution.'),
	}),
	sections: {
		conditions: section("Conditions", {
			extract: (q:any) => {
				const ts = q.selectAll("code[lang=ts]")
				const typescript = q.selectAll("code[lang=typescript]")
				const blocks = [...ts, ...typescript]

				return blocks
			},
			alternatives: ["Run Condition", "Only If", "Only When"]
		})
	}
})

export const Task = defineModel("Task", {
	prefix: "tasks",
	description: "Tasks are one-off prompts for small changes, bugfixes, documentation, reports, etc. They run once and are marked completed.  The Conditions section is a special section used to short circuit the task being run.  You will almost never need this.",
	meta: z.object({
		agent: z.string().describe("The agent that is responsible for the task.").default("claude"),
		createdBy: z.string().describe("Who created this task").default("soederpop"),
		tags: z.array(z.string()).describe("Tags for categorizing the task").optional(),
		completedAt: z.string().optional().describe("ISO timestamp of when this task was completed"),
		lastRanAt: z.number().optional().describe('Timestamp set when the task has been executed'),
		running: z.boolean().optional().default(false).describe('Set to true while the task is actively being executed by the scheduler. Prevents double execution.'),
	}),
	sections: {
		conditions: section("Conditions", {
			extract: (q:any) => {
				const ts = q.selectAll("code[lang=ts]")
				const typescript = q.selectAll("code[lang=typescript]")
				const blocks = [...ts, ...typescript]

				return blocks
			},
			alternatives: ["Run Condition", "Only If", "Only When"]
		})
	}
})

export const Prompt = defineModel("Prompt", {
	prefix: "prompts",
	description: "Prompts are reusable prompts that can be handled by coding assistants, or luca's assistants, through the `luca prompt` command.",
	meta: z.object({
		tags: z.array(z.string()).describe("Tags for categorizing the prompt").optional(),	
		repeatable: z.boolean().describe('A prompt can be repeatable false, and have lastRanAt set so it wont run').default(true),
		lastRanAt: z.number().optional().describe('a timestamp for when this prompt was ran last. Set to mark a repeatable prompt as not repeatable in the agentic loop'),
	  inputs: z.record(
				z.string(),
				z.object({
					type: z.enum(['string','number','input']).default('string'),
					description: z.string().optional().describe("Description of the input, shown as placeholder text"),
					question: z.string().optional().describe("The question to ask the user for input, otherwise the key is used as the question"),
				})
			).describe('inputs will be replaced in the prompt, where {{double}} brackets are used to match the name').optional()
	})
})

export const Project = defineModel("Project", {
	prefix: "projects",
	description: "Projects are home documents for one or more plans that need to be sequentially carried out by one or more different agents with unique setups.",
	meta: z.object({
		status: z.enum(["draft", "approved", "building", "in_progress", "completed", "failed", "reviewing"]).default("draft")
			.describe("draft is being planned, ready means all plans are approved, running means execution is in progress, completed means all plans finished, failed means execution stopped due to an error, reviewing could happen in between draft->approval, or in between in_progress and completed ( in between plan execution)"),
		goal: z.string().optional().describe("Slug of the goal this project is aligned to"),
	}),
	sections: {
		overview: section("Overview", {
			extract: (q: any) => q.selectAll("*").map((n: any) => toString(n)).join("\n"),
			schema: z.string().describe("High-level overview of what this project accomplishes"),
		}),
		execution: section("Execution", {
			extract: (q: any) => q.selectAll("listItem").map((n: any) => toString(n)),
			schema: z.array(z.string()).describe(
				"Ordered execution steps. Each list item is a link to a plan (e.g. [Plan Title](plans/my-plan)). " +
				"Multiple plans on the same list item separated by commas run in parallel."
			),
			alternatives: ["Execution Plan", "Execution Order"],
		}),
	},
	scopes: {
		approved: (q) => q.where("meta.status", "approved")
	},
	relationships: {
		goal: belongsTo(() => Goal, {
			foreignKey: (doc: any) => doc.meta.goal as string,
		}),
		plans: hasMany(() => Plan, { }),
	},
	computed: {
		executionOrder: (self: any) => {
			const query = self.document.querySection("Execution");
			return query.selectAll("listItem").map((item: any) =>
				new AstQuery({ type: "root", children: [item] }).selectAll("link").map((link: any) => link.url)
			).filter((group: any[]) => group.length > 0);
		},
	},
});


export const Plan = defineModel("Plan", {
	prefix: "plans",
	description: "Plans are literal claude code generated /plan documents with testing criteria, resources, etc.  They need to be approved to be picked up by the project builder",
	pattern: ["plans/:project/:slug", "plans/:slug"],
	meta: z.object({
		status: z.enum(["approved", "pending", "rejected", "completed", "building", "in_progress"]).default("pending").describe("The status of the plan, approved is ready to implement, pending is waiting for approval, rejected is not approved, completed means successfully executed."),
		project: z.string().optional().describe("Slug of the project this plan belongs to"),
		costUsd: z.number().optional().describe("Total cost in USD for the Claude Code session that executed this plan"),
		turns: z.number().optional().describe("Number of turns in the Claude Code session"),
		toolCalls: z.number().optional().describe("Number of tool calls made during execution"),
		completedAt: z.string().optional().describe("ISO timestamp of when this plan was completed"),
		agentOptions: z.record(z.any()).optional().describe("Options passed through to the Claude Code session (model, effort, maxBudgetUsd, chrome, allowedTools, systemPrompt, etc.)"),
	}),
	sections: {
		references: section("References", {
			extract: (q: any) => q.selectAll("listItem").map((n: any) => toString(n)),
			schema: z.array(z.string()).describe("Each plan should have a section that defines the references for the plan."),
			alternatives: ["Reference Sources", "Resources"],
		}),
		verification: section("Test plan", {
			extract: (q: any) => q.selectAll("listItem").map((n: any) => toString(n)),
			schema: z.array(z.string()).describe("Each plan should have a section that defines the test plan for the plan."),
			alternatives: ["Validation"],
		}),
	},
	relationships: {
		project: belongsTo(() => Project, {
			foreignKey: (doc: any) => doc.meta.project as string,
		}),
	},
	scopes: {
		approved: (q:any) => q
	}
});


export const Memory = defineModel("Memory", {
	prefix: "memories",
	description: "Memories are used to control the chief of staff assistant's personality, knowledge of me, and its immediate todos"
})


