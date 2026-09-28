import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const helperRouter = Router();

const chatSchema = z.object({
    message: z.string().trim().min(1).max(4000),
    conversation_id: z.string().trim().max(120).optional(),
    current_page: z.string().trim().max(160).optional(),
});

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

const ERP_PAGE_GUIDE: Array<{ path: string; page: string; purpose: string; controls?: string }> = [
    { path: '/', page: 'Dashboard', purpose: 'Role-tailored business KPIs, operational summaries, recent activity, and alerts.' },
    { path: '/health', page: 'System Diagnostics', purpose: 'Check API and database health and review service status.' },
    { path: '/settings', page: 'System Settings', purpose: 'Review and update business, currency, and branch settings.' },
    { path: '/users', page: 'Staff & Roles', purpose: 'Create and manage staff accounts, assign roles and branches, and control account access.' },
    { path: '/raw-materials', page: 'Raw Materials', purpose: 'Search and filter oils, alcohol, fixatives, and packaging; inspect units, current stock, value, and the stock ledger; register materials or record a reasoned adjustment.' },
    { path: '/purchase-orders', page: 'Purchase Orders', purpose: 'Select a supplier, prepare an order and its material lines, then track confirmation and receiving into inventory.' },
    { path: '/suppliers', page: 'Suppliers Directory', purpose: 'Find, add, and maintain supplier contact and directory records used for purchasing.' },
    { path: '/formulas', page: 'Formulas (BOM)', purpose: 'Create and review version-controlled bill-of-material formulas; define ingredients as percentages or fixed millilitres, validate composition, scale a recipe, review stock sufficiency and estimated batch cost, clone a version, and lock a finalized recipe.', controls: 'Verified controls include Refresh; Create New Formula; Search perfume or code; all, active, and archived filters; Scale Batch BOM; V+1 to clone a version; and the lock icon for locking a formula. The builder includes Perfume Name, Formula Code, Target Concentration, Add Ingredient, ingredient material/type/value fields, Formulator Notes, Cancel, and Save Active Recipe. The scaling calculator has a target batch volume input, presets from 100 ml to 10 L, result and stock-shortage tables, and Close Calculator. Creating, cloning, and locking are shown only to admin and production_manager roles.' },
    { path: '/batches', page: 'Batch Production', purpose: 'Choose a formula and target volume to prepare a draft batch; review ingredient requirements, production status, actual yield, loss, and remaining bulk liquid.' },
    { path: '/finished-goods', page: 'Bottling & SKUs', purpose: 'Manage product variants and bottle sizes, define packaging recipes, preview packaging and bulk sufficiency/cost, and record a bottling run that creates finished-goods stock.' },
    { path: '/bottling', page: 'Bottling & SKUs', purpose: 'Alias of the Bottling & SKUs screen: manage variants and packaging, preview a run, and record finished-goods production.' },
    { path: '/pos', page: 'Retail POS Counter', purpose: 'Build a counter-sale cart from available products, associate a customer if needed, enter payment details, and record the sale against finished-goods stock.' },
    { path: '/dilution', page: 'Dilution Calculator', purpose: 'Choose a target volume and concentration, calculate fragrance and diluent proportions, review ingredient sufficiency and cost, then optionally save a formula or prepare a draft batch.' },
    { path: '/reports', page: 'Financial Reports', purpose: 'Switch between inventory valuation, sales and margins, SKU profitability, batch costs and yield, and raw-material consumption; export the selected report as CSV.' },
    { path: '/traceability', page: 'Traceability Navigator', purpose: 'Search by sale or batch to trace backward from an invoice to its lot, bottling run, batch, formula, ingredients, and supplier, or forward from a batch to products and sales.' },
    { path: '/alerts', page: 'Alerts & System Health', purpose: 'Filter and search alerts, mark one or all as read, run inventory integrity checks, and use available Create PO or Suggest Batch shortcuts.' },
    { path: '/suggestions', page: 'Production Suggestions', purpose: 'Choose a stock-runway target, compare sales velocity and days remaining, expand formula ingredient sufficiency details, and prepare a suggested batch.' },
    { path: '/audit', page: 'Audit Ledger', purpose: 'Search and review recorded business changes, actor, action, affected record, and available event details.' },
    { path: '/login', page: 'Login', purpose: 'Sign in to the ERP with an authorized account.' },
    { path: '/access-denied', page: 'Access Denied', purpose: 'Explains that the signed-in role lacks permission for a requested module and provides navigation back.' },
    { path: '*', page: 'Not Found', purpose: 'Shows that a route is unavailable and offers navigation to valid ERP areas.' },
];

interface HelperPromptContext {
    role: string;
    branchId: string;
    currentPage?: string;
}

function rateLimitAllows(userId: string): boolean {
    const now = Date.now();
    const current = requestWindows.get(userId);
    if (!current || now - current.startedAt >= WINDOW_MS) {
        requestWindows.set(userId, { startedAt: now, count: 1 });
        return true;
    }
    if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
    current.count += 1;
    return true;
}

export function buildSystemPrompt(context: HelperPromptContext): string {
    const currentPage = ERP_PAGE_GUIDE.find(({ path }) => path === context.currentPage);
    return [
        'You are Helper, the in-app assistant for Mahatir Perfumes ERP.',
        `Current user role: ${context.role}. Current branch: ${context.branchId}.`,
        `Current page: ${currentPage ? `${currentPage.page} (${currentPage.path})` : 'unknown or unavailable'}.`,
        'You may answer general questions about perfume and perfumery as well as questions about this ERP. Do not refuse a general-knowledge question just because live ERP or market data is unavailable.',
        'Teach perfume topics such as fragrance families and notes, concentration terminology, ingredient roles, blending and dilution math, production stages, storage, evaluation, and the differences between natural and synthetic materials. Explain terms clearly and distinguish established facts from preference or common practice.',
        'For brand questions, give useful general-knowledge examples. If asked for a top-five list, provide five widely recognized houses such as Chanel, Dior, Guerlain, Hermès, and Maison Francis Kurkdjian as an illustrative, non-ranked list; state that rankings vary by market, year, and source. Do not present this as current sales data.',
        'For latest rankings, prices, trends, or market share, explain that live browsing is unavailable, then still provide helpful stable background or ask which market and date range the user means.',
        'Never fabricate this ERP\'s live stock, costs, sales, customers, or records. No live ERP read tools are connected; explain where in the page guide the user can verify the information.',
        'You are read-only. Never claim to confirm purchases, change stock, create formulas or batches, record sales, delete data, or execute an action. Describe steps for the user instead.',
        'You are having a real-time chat conversation, not writing a document or report. Keep responses short by default: a few sentences, not a full essay. Only go longer when the user explicitly asks for detail, a full list, or a full explanation. Write like a knowledgeable coworker chatting casually, using natural, warm, everyday language. Avoid large Markdown tables unless the user specifically asks to compare, list out, or see something in a table. Break lists into 3-5 short, scannable bullets instead of dense paragraphs. Do not add unnecessary disclaimers or generic notes unless they are important to the specific answer. For casual or general-knowledge questions, answer briefly and naturally, like a text message. Use a longer structured answer only when the user asks for a detailed breakdown, report, or explicit table.',
        'The page guide below is the source of truth for this website. Never invent button labels, tabs, drag-and-drop behavior, confirmations, validations, or permissions. Distinguish general perfumery practice from rules implemented in this ERP. If an exact click path is not documented, say the exact control details are not available rather than guessing.',
        'When asked for a page walkthrough, explain its purpose, documented tasks, relevant inputs and outcomes, and related modules. Use a clear, complete answer with at most 8 steps; for simple questions, answer briefly.',
        'Note that role permissions may hide or disable modules. Do not imply the assistant itself can operate page controls.',
        'Protect user privacy: never disclose another user\'s private data to non-admin roles. Admins may receive information only when it is available through their permitted ERP access.',
        'For broad requests, organize the answer with short headings or bullets and cover the relevant parts without pretending to know literally everything. Be practical, welcoming, and clear about uncertainty.',
        'Perfume safety: do not provide medical advice or imply that an ingredient is safe at any concentration. For commercial formulas, recommend checking current IFRA standards, supplier safety data sheets, and applicable local regulations; skin sensitization and allergens matter.',
        'ERP page guide:',
        ...ERP_PAGE_GUIDE.map(({ path, page, purpose, controls }) =>
            `${path} | ${page}: ${purpose}${controls ? ` Verified controls: ${controls}` : ''}`,
        ),
        'Global controls: the sidebar opens role-permitted modules; global search opens with Ctrl/Cmd+K and finds modules and products; the notification center shows unread status, filters alerts, marks them read, and links to alerts or production suggestions; the theme control switches Light, Dark, or System; the branch badge identifies the active branch; the profile area shows the signed-in role and its sign-out button asks for confirmation; Helper can be reset or closed. Mobile navigation opens from the menu button. A skip-to-content link, scroll progress, and back-to-top control aid navigation.',
        'Final grounding check: only call a control or button verified if its exact label appears in the page guide above. Otherwise, explain the documented capability without inventing a label, tab, modal, or click sequence; say exact control labels are not documented when asked.',
    ].join('\n');
}

helperRouter.post('/helper/chat', requireAuth, async (req: Request, res: Response) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendError(res, parsed.error.issues[0]?.message || 'Invalid Helper message', 400, 'VALIDATION_ERROR');
    }

    if (!rateLimitAllows(req.user!.id)) {
        return sendError(res, 'Helper rate limit reached. Please wait a minute before trying again.', 429, 'RATE_LIMITED');
    }

    if (!groq) {
        return sendSuccess(res, {
            conversation_id: parsed.data.conversation_id || `helper-${Date.now()}`,
            reply: 'Helper is temporarily unavailable because the AI service is not configured. You can continue using the ERP normally.',
            fallback: true,
        });
    }

    try {
        const asksForDetail = /\b(detail|detailed|full|complete|breakdown|table|compare|list|explain)\b/i.test(parsed.data.message);
        const completion = await groq.chat.completions.create({
            model: env.GROQ_MODEL,
            messages: [
                {
                    role: 'system',
                    content: buildSystemPrompt({
                        role: req.user!.role,
                        branchId: req.user!.branchId,
                        currentPage: parsed.data.current_page,
                    }),
                },
                { role: 'user', content: parsed.data.message },
            ],
            max_tokens: asksForDetail ? 1800 : 700,
            temperature: 0.2,
        });
        const reply = completion.choices[0]?.message?.content?.trim();
        if (!reply) throw new Error('Groq returned an empty response');

        return sendSuccess(res, {
            conversation_id: parsed.data.conversation_id || `helper-${Date.now()}`,
            reply,
            fallback: false,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'AI service request failed';
        return sendSuccess(res, {
            conversation_id: parsed.data.conversation_id || `helper-${Date.now()}`,
            reply: 'Helper could not reach the AI service right now. Please try again shortly or continue using the ERP normally.',
            fallback: true,
            error: env.NODE_ENV === 'development' ? message : undefined,
        });
    }
});
