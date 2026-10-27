import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type DMChannel,
	type Guild,
	type GuildMember,
	type Message,
	type PartialDMChannel,
	type PermissionsBitField,
	type Role,
	type TextChannel
} from 'discord.js';
import { getMeta, newId, setMeta } from '../src/lib/server/db';
import { COLORS } from './format';

/**
 * Membership applications.
 *
 * `/apply` only works in a channel called #apply. The bot then asks the five
 * questions in DMs and drops the finished form in #staff-verify (created on
 * demand, visible to administrators only) with Approve / Deny buttons.
 *
 * `/initapply` posts or refreshes the guide embed in #apply, and every other
 * message in that channel is removed automatically so it stays readable.
 *
 * In-flight answers, submitted forms and configuration live in the shared
 * `meta` key/value store, so a bot restart does not lose anything.
 */

export const APPLY_CHANNEL = 'apply';
export const STAFF_CHANNEL = 'staff-verify';

const DWELLER_NAME = 'Dweller';
const DWELLER_COLOR = 0x9fb4c7; // light blue-grey
const CITIZEN_NAME = 'Citizen';
const CITIZEN_COLOR = 0x34d399;
const STATE_TTL_MS = 60 * 60 * 1000;

const IGN_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const MIN_ANSWER = 3;
const MAX_ANSWER = 900;
const QUESTION_COUNT = 5;

type Step = 'ign' | 'age' | 'timezone' | 'reason' | 'goals';
type Decision = 'pending' | 'approved' | 'denied';

interface DmState {
	step: Step;
	guildId: string;
	startedAt: number;
	ign?: string;
	age?: number;
	timezone?: string;
	reason?: string;
	goals?: string;
}

interface Application {
	id: string;
	guildId: string;
	userId: string;
	userTag: string;
	displayName: string;
	avatarUrl: string;
	ign: string;
	age?: number;
	timezone?: string;
	reason: string;
	goals: string;
	createdAt: number;
	status: Decision;
	reviewerId?: string;
	decidedAt?: number;
	messageId?: string;
}

const stateKey = (userId: string) => `apply:state:${userId}`;
const itemKey = (id: string) => `apply:item:${id}`;
const pendingKey = () => 'apply:pending';
const staffKey = (guildId: string) => `apply:staff_channel:${guildId}`;
const dwellerKey = (guildId: string) => `apply:dweller_role:${guildId}`;
const citizenKey = (guildId: string) => `apply:citizen_role:${guildId}`;
const guideKey = (guildId: string) => `apply:guide_message:${guildId}`;

async function readJson<T>(key: string): Promise<T | null> {
	const raw = await getMeta(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

async function writeJson(key: string, value: unknown): Promise<void> {
	await setMeta(key, JSON.stringify(value));
}

async function pendingIds(): Promise<string[]> {
	return (await readJson<string[]>(pendingKey())) ?? [];
}

async function addPending(id: string): Promise<void> {
	const ids = await pendingIds();
	if (!ids.includes(id)) {
		ids.push(id);
		await writeJson(pendingKey(), ids);
	}
}

async function removePending(id: string): Promise<void> {
	const ids = await pendingIds();
	const next = ids.filter((entry) => entry !== id);
	if (next.length !== ids.length) await writeJson(pendingKey(), next);
}

function ephemeral(content: string): { content: string; flags: MessageFlags.Ephemeral } {
	return { content, flags: MessageFlags.Ephemeral };
}

function hasStaffPermission(permissions: Readonly<PermissionsBitField> | null): boolean {
	return Boolean(
		permissions?.has(PermissionFlagsBits.ManageGuild) ||
			permissions?.has(PermissionFlagsBits.Administrator)
	);
}

async function findRole(guild: Guild, name: string, storedId: string | null): Promise<Role | null> {
	if (storedId && guild.roles.cache.has(storedId)) return guild.roles.cache.get(storedId) ?? null;

	await guild.roles.fetch().catch(() => undefined);

	if (storedId) {
		const stored = guild.roles.cache.get(storedId);
		if (stored) return stored;
	}

	return guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/** Find or create the base role every new member receives. */
export async function ensureDwellerRole(guild: Guild): Promise<Role> {
	const storedId = await getMeta(dwellerKey(guild.id));
	let role = await findRole(guild, DWELLER_NAME, storedId);

	if (role) {
		if (!storedId) await setMeta(dwellerKey(guild.id), role.id);
		// Discord gives new roles a default (unset) colour. Adopt the intended
		// light blue-grey instead of overriding a deliberate custom colour.
		if (role.color === 0) {
			await role
				.setColor(DWELLER_COLOR, 'Set the Dweller role colour')
				.catch((error) =>
					console.error(
						'[bot] Could not recolour the Dweller role:',
						error instanceof Error ? error.message : error
					)
				);
		}
		return role;
	}

	role = await guild.roles.create({
		name: DWELLER_NAME,
		color: DWELLER_COLOR,
		hoist: false,
		mentionable: false,
		reason: 'Default role for new members'
	});
	await setMeta(dwellerKey(guild.id), role.id);
	return role;
}

/** Find or create the role approved applicants receive. */
export async function ensureCitizenRole(guild: Guild): Promise<Role> {
	const storedId = await getMeta(citizenKey(guild.id));
	let role = await findRole(guild, CITIZEN_NAME, storedId);

	if (!role) {
		role = await guild.roles.create({
			name: CITIZEN_NAME,
			color: CITIZEN_COLOR,
			hoist: false,
			mentionable: false,
			reason: 'Role for approved members'
		});
	}

	await setMeta(citizenKey(guild.id), role.id);
	return role;
}

/** DM channel or the plain text channel #staff-verify, creating it if needed. */
async function findStaffChannel(guild: Guild): Promise<TextChannel | null> {
	const storedId = await getMeta(staffKey(guild.id));
	if (storedId) {
		const cached = guild.channels.cache.get(storedId);
		const channel =
			cached ?? (await guild.channels.fetch(storedId).catch(() => null));
		if (channel && channel.type === ChannelType.GuildText) return channel as TextChannel;
		await setMeta(staffKey(guild.id), null);
	}

	const fetched = await guild.channels.fetch().catch(() => null);
	const channels = fetched ? [...fetched.values()] : [...guild.channels.cache.values()];
	const existing = channels.find(
		(channel): channel is TextChannel =>
			channel !== null &&
			channel.type === ChannelType.GuildText &&
			channel.name.toLowerCase() === STAFF_CHANNEL
	);

	if (existing) {
		await setMeta(staffKey(guild.id), existing.id);
		return existing;
	}
	return null;
}

/**
 * Locate #staff-verify. When it is missing, create it with @everyone denied
 * View Channel — Discord administrators bypass channel overwrites, so the
 * result is an admin-only room without hardcoding a role.
 */
export async function ensureStaffChannel(guild: Guild): Promise<TextChannel> {
	const existing = await findStaffChannel(guild);
	if (existing) return existing;

	const me = guild.members.me ?? (await guild.members.fetchMe());
	const created = await guild.channels.create({
		name: STAFF_CHANNEL,
		type: ChannelType.GuildText,
		topic: 'Private queue for #apply submissions. Approve or deny with the buttons.',
		permissionOverwrites: [
			{
				id: guild.roles.everyone.id,
				deny: [PermissionFlagsBits.ViewChannel]
			},
			{
				id: me.id,
				allow: [
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.SendMessages,
					PermissionFlagsBits.EmbedLinks,
					PermissionFlagsBits.ReadMessageHistory,
					PermissionFlagsBits.ManageMessages
				]
			}
		],
		reason: 'Admin-only application review channel'
	});

	await setMeta(staffKey(guild.id), created.id);
	console.log(`[bot] Created #${STAFF_CHANNEL} in ${guild.name}.`);
	return created;
}

/** Prepare the default role and review channel for a guild. */
export async function syncGuild(guild: Guild): Promise<void> {
	try {
		await ensureDwellerRole(guild);
	} catch (error) {
		console.error(
			`[bot] Could not prepare the Dweller role in ${guild.name}:`,
			error instanceof Error ? error.message : error
		);
	}
	try {
		await ensureStaffChannel(guild);
	} catch (error) {
		console.error(
			`[bot] Could not prepare #${STAFF_CHANNEL} in ${guild.name}:`,
			error instanceof Error ? error.message : error
		);
	}
}

function applicationGuideEmbed(guild: Guild): EmbedBuilder {
	const bot = guild.client.user ? `<@${guild.client.user.id}>` : 'The bot';
	return new EmbedBuilder()
		.setColor(DWELLER_COLOR)
		.setAuthor({ name: `Join ${guild.name}` })
		.setTitle('How to apply')
		.setDescription(
			`${bot} handles applications in this channel. Run \`/apply\` below to begin — the questions are answered in your DMs.`
		)
		.addFields(
			{ name: '1 · Start', value: 'Run `/apply` in this channel. Other messages here are removed automatically.' },
			{
				name: '2 · Answer in DMs',
				value: `Reply to the ${QUESTION_COUNT} questions in the bot’s DM. Type \`cancel\` at any time to stop.`
			},
			{
				name: '3 · Wait for review',
				value: 'Staff review every application privately. You will get a DM with the decision.'
			},
			{
				name: 'What we ask',
				value: '• Minecraft IGN\n• Age (13+)\n• Timezone and usual play times\n• Why you want to join\n• What you want to do or contribute'
			},
			{
				name: 'Before you start',
				value: 'You must be 13+ and have **Direct Messages** from server members enabled.'
			}
		)
		.setFooter({ text: 'Settlers III · Applications' });
}

/** `/initapply` — post or refresh the guide embed in #apply. */
export async function postApplicationGuide(
	interaction: ChatInputCommandInteraction
): Promise<void> {
	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply(ephemeral('This command only works inside a server.'));
		return;
	}

	if (!hasStaffPermission(interaction.memberPermissions)) {
		await interaction.reply(
			ephemeral('You need the **Manage Server** permission to post the application guide.')
		);
		return;
	}

	const channel = interaction.channel;
	if (
		!channel ||
		channel.type !== ChannelType.GuildText ||
		channel.name.toLowerCase() !== APPLY_CHANNEL
	) {
		await interaction.reply(
			ephemeral(
				`Run this in the **#${APPLY_CHANNEL}** text channel so the guide lands in the right place.`
			)
		);
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const key = guideKey(guild.id);
	const storedId = await getMeta(key);
	let message = storedId ? await channel.messages.fetch(storedId).catch(() => null) : null;
	let action: 'posted' | 'updated' = 'posted';

	if (message) {
		try {
			await message.edit({ embeds: [applicationGuideEmbed(guild)] });
			action = 'updated';
		} catch {
			message = null;
		}
	}

	if (!message) {
		message = await channel.send({ embeds: [applicationGuideEmbed(guild)] });
		await setMeta(key, message.id);
	}

	// Pinning is best-effort; the guide is still useful without it.
	await message.pin().catch(() => undefined);

	await interaction.editReply({
		content: `Application guide ${action} in <#${channel.id}>.`
	});
}

let lastApplyDeleteWarning = 0;

/**
 * Keep #apply clean. The bot's own messages (the /initapply guide) stay; every
 * other message is removed. Keeping all bot messages also avoids a race where
 * the guide's gateway event arrives before its message id is stored.
 */
export async function handleApplyChannelMessage(message: Message): Promise<void> {
	if (!message.guild) return;
	const channel = message.channel;
	if (channel.type !== ChannelType.GuildText || channel.name.toLowerCase() !== APPLY_CHANNEL) {
		return;
	}
	if (!message.system && message.author.id === message.client.user?.id) return;

	try {
		await message.delete();
	} catch (error) {
		const now = Date.now();
		if (now - lastApplyDeleteWarning > 60_000) {
			lastApplyDeleteWarning = now;
			console.error(
				'[bot] Could not delete a message in #apply. Give the bot Manage Messages:',
				error instanceof Error ? error.message : error
			);
		}
	}
}

/** Give a new member the Dweller role. */
export async function addDwellerRole(member: GuildMember): Promise<void> {
	try {
		const role = await ensureDwellerRole(member.guild);
		await member.roles.add(role, 'Default role for new members');
	} catch (error) {
		console.error(
			`[bot] Could not give ${member.user.tag} the Dweller role:`,
			error instanceof Error ? error.message : error
		);
	}
}

function questionEmbed(guildName: string, question: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(DWELLER_COLOR)
		.setAuthor({ name: `Application · ${guildName}` })
		.setDescription(question)
		.setFooter({ text: 'Reply here in DMs · type “cancel” to stop' });
}

const QUESTIONS: Record<Step, (guildName: string) => string> = {
	ign: () =>
		`**Question 1 of ${QUESTION_COUNT}**\nWhat is your Minecraft in-game name (IGN)?\n\n_3–16 letters, numbers or underscores._`,
	age: () =>
		`**Question 2 of ${QUESTION_COUNT}**\nHow old are you?\n\n_You must be at least 13 to use Discord and apply._`,
	timezone: () =>
		`**Question 3 of ${QUESTION_COUNT}**\nWhat is your timezone, and when are you usually online?\n\n_Example: GMT+1, weekday evenings and weekends._`,
	reason: (guildName) =>
		`**Question 4 of ${QUESTION_COUNT}**\nWhy do you want to join **${guildName}**?`,
	goals: () =>
		`**Question 5 of ${QUESTION_COUNT}**\nWhat do you want to do or contribute here? (build, trade, explore, join a town, help others…)`
};

const NEXT_STEP: Record<Step, Step | null> = {
	ign: 'age',
	age: 'timezone',
	timezone: 'reason',
	reason: 'goals',
	goals: null
};

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

type AnswerCheck = { ok: true } | { ok: false; error: string; cancel?: boolean };

function checkAnswer(step: Step, content: string): AnswerCheck {
	if (step === 'ign') {
		return IGN_PATTERN.test(content)
			? { ok: true }
			: {
					ok: false,
					error:
						'That does not look like a Minecraft username. Use 3–16 letters, numbers or underscores.'
				};
	}

	if (step === 'age') {
		if (!/^\d{1,3}$/.test(content)) {
			return { ok: false, error: 'Please reply with your age as a number between 13 and 120.' };
		}
		const age = Number(content);
		if (age < 13) {
			return {
				ok: false,
				error:
					'You must be at least 13 to use Discord and apply. This application has been cancelled.',
				cancel: true
			};
		}
		if (age > 120) {
			return { ok: false, error: 'Please enter a realistic age between 13 and 120.' };
		}
		return { ok: true };
	}

	if (content.length < MIN_ANSWER) {
		return { ok: false, error: 'Please write a little more than that.' };
	}
	if (content.length > MAX_ANSWER) {
		return { ok: false, error: `Keep it under ${MAX_ANSWER} characters, please.` };
	}
	return { ok: true };
}

function applicationEmbed(app: Application, guild: Guild): EmbedBuilder {
	const decided = app.status !== 'pending';
	const color = app.status === 'approved' ? COLORS.bid : app.status === 'denied' ? COLORS.danger : DWELLER_COLOR;

	const embed = new EmbedBuilder()
		.setColor(color)
		.setAuthor({ name: `Application · ${app.userTag}`, iconURL: app.avatarUrl || undefined })
		.setTitle(`IGN: ${app.ign}`)
		.setDescription(`<@${app.userId}> · \`${app.userTag}\``)
		.addFields(
			{ name: 'Submitted', value: `<t:${Math.floor(app.createdAt / 1000)}:R>`, inline: true },
			{ name: 'Server', value: guild.name, inline: true },
			{ name: 'Age', value: app.age != null ? String(app.age) : '—', inline: true },
			{
				name: 'Timezone / activity',
				value: app.timezone ? truncate(app.timezone, 1024) : '—',
				inline: true
			},
			{ name: 'Why they joined', value: truncate(app.reason, 1024) },
			{ name: 'What they want to do', value: truncate(app.goals, 1024) }
		)
		.setFooter({ text: 'Settlers III · Applications' });

	if (decided) {
		const verb = app.status === 'approved' ? 'Approved' : 'Denied';
		embed.addFields({
			name: `${verb} by`,
			value: app.reviewerId
				? `<@${app.reviewerId}> · <t:${Math.floor((app.decidedAt ?? Date.now()) / 1000)}:R>`
				: 'staff'
		});
	}

	return embed;
}

function decisionRow(id: string): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`apply:approve:${id}`)
			.setLabel('Approve')
			.setEmoji('✅')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId(`apply:deny:${id}`)
			.setLabel('Deny')
			.setEmoji('⛔')
			.setStyle(ButtonStyle.Danger)
	);
}

async function alreadyPending(userId: string, guildId: string): Promise<boolean> {
	for (const id of await pendingIds()) {
		const app = await readJson<Application>(itemKey(id));
		if (!app || app.status !== 'pending') {
			await removePending(id);
			continue;
		}
		if (app.userId === userId && app.guildId === guildId) return true;
	}
	return false;
}

/** `/apply` — only valid inside a channel named #apply. */
export async function startApplication(interaction: ChatInputCommandInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply(ephemeral('Applications are only available inside a server.'));
		return;
	}

	const channelName =
		interaction.channel && 'name' in interaction.channel ? interaction.channel.name : null;
	if (channelName?.toLowerCase() !== APPLY_CHANNEL) {
		const fetched = await guild.channels.fetch().catch(() => null);
		const channels = fetched ? [...fetched.values()] : [...guild.channels.cache.values()];
		const applyChannel = channels.find(
			(channel): channel is TextChannel =>
				channel !== null &&
				channel.type === ChannelType.GuildText &&
				channel.name.toLowerCase() === APPLY_CHANNEL
		);
		await interaction.reply(
			ephemeral(
				applyChannel
					? `Applications are only accepted in <#${applyChannel.id}>.`
					: 'Applications are only accepted in a channel named **#apply**. Create it first.'
			)
		);
		return;
	}

	if (await alreadyPending(interaction.user.id, guild.id)) {
		await interaction.reply(
			ephemeral('You already have an application waiting for review. Staff will be in touch.')
		);
		return;
	}

	const state: DmState = { step: 'ign', guildId: guild.id, startedAt: Date.now() };
	await writeJson(stateKey(interaction.user.id), state);

	try {
		await interaction.user.send({
			embeds: [questionEmbed(guild.name, QUESTIONS.ign(guild.name))]
		});
	} catch {
		await setMeta(stateKey(interaction.user.id), null);
		await interaction.reply(
			ephemeral(
				'I could not send you a DM. Enable “Direct Messages” from server members in your privacy settings and run `/apply` again.'
			)
		);
		return;
	}

	await interaction.reply({
		content: 'Check your DMs — I have sent the first question.',
		flags: MessageFlags.Ephemeral
	});
}

async function sendDm(
	channel: DMChannel | PartialDMChannel,
	embed: EmbedBuilder
): Promise<void> {
	await channel.send({ embeds: [embed] }).catch(() => undefined);
}

async function submitApplication(
	state: DmState,
	message: Message
): Promise<void> {
	const guild =
		message.client.guilds.cache.get(state.guildId) ??
		(await message.client.guilds.fetch(state.guildId).catch(() => null));

	if (!guild) {
		await setMeta(stateKey(message.author.id), null);
		await sendDm(
			message.channel as DMChannel,
			new EmbedBuilder()
				.setColor(COLORS.danger)
				.setDescription('That server is no longer available, so your application was not sent.')
		);
		return;
	}

	const member = await guild.members.fetch(message.author.id).catch(() => null);
	if (!member) {
		await setMeta(stateKey(message.author.id), null);
		await sendDm(
			message.channel as DMChannel,
			new EmbedBuilder()
				.setColor(COLORS.danger)
				.setDescription(`You are no longer a member of ${guild.name}, so your application was not sent.`)
		);
		return;
	}

	const app: Application = {
		id: newId(),
		guildId: guild.id,
		userId: message.author.id,
		userTag: message.author.username,
		displayName: message.author.displayName,
		avatarUrl: message.author.displayAvatarURL({ size: 128 }),
		ign: state.ign ?? '',
		age: state.age,
		timezone: state.timezone ?? '',
		reason: state.reason ?? '',
		goals: state.goals ?? '',
		createdAt: Date.now(),
		status: 'pending'
	};

	let channel: TextChannel;
	try {
		channel = await ensureStaffChannel(guild);
	} catch (error) {
		console.error(
			'[bot] Could not open the staff review channel:',
			error instanceof Error ? error.message : error
		);
		await setMeta(stateKey(message.author.id), null);
		await sendDm(
			message.channel as DMChannel,
			new EmbedBuilder()
				.setColor(COLORS.danger)
				.setDescription(
					`I could not reach the staff review channel, so your application was not sent. Please contact staff in ${guild.name}.`
				)
		);
		return;
	}

	try {
		const posted = await channel.send({
			embeds: [applicationEmbed(app, guild)],
			components: [decisionRow(app.id)]
		});
		app.messageId = posted.id;
	} catch (error) {
		console.error(
			'[bot] Could not post an application:',
			error instanceof Error ? error.message : error
		);
		await setMeta(stateKey(message.author.id), null);
		await sendDm(
			message.channel as DMChannel,
			new EmbedBuilder()
				.setColor(COLORS.danger)
				.setDescription(
					`I could not deliver your application to staff. Please try \`/apply\` again in a moment.`
				)
		);
		return;
	}

	await writeJson(itemKey(app.id), app);
	await addPending(app.id);
	await setMeta(stateKey(message.author.id), null);

	await sendDm(
		message.channel as DMChannel,
		new EmbedBuilder()
			.setColor(COLORS.bid)
			.setAuthor({ name: `Application submitted · ${guild.name}` })
			.setDescription(
				'Thanks! Your application is waiting for staff review. You will get a DM here once it is approved or denied.'
			)
			.addFields(
				{ name: 'IGN', value: `\`${app.ign}\``, inline: true },
				{ name: 'Age', value: app.age != null ? String(app.age) : '—', inline: true },
				{ name: 'Timezone / activity', value: truncate(app.timezone || '—', 1024) },
				{ name: 'Why you joined', value: truncate(app.reason, 1024) },
				{ name: 'What you want to do', value: truncate(app.goals, 1024) }
			)
			.setFooter({ text: 'Settlers III · Applications' })
	);
}

/** Handle a DM reply while an application is in progress. */
export async function handleApplicationDm(message: Message): Promise<void> {
	if (message.author.bot) return;
	if (!message.channel.isDMBased()) return;

	const key = stateKey(message.author.id);
	const state = await readJson<DmState>(key);
	if (!state) return; // Not an application conversation; stay quiet.

	const channel = message.channel as DMChannel | PartialDMChannel;
	const content = message.content.trim();

	if (/^(cancel|stop|quit)$/i.test(content)) {
		await setMeta(key, null);
		await sendDm(
			channel,
			new EmbedBuilder()
				.setColor(COLORS.neutral)
				.setDescription('Application cancelled. You can run `/apply` again whenever you are ready.')
		);
		return;
	}

	if (Date.now() - state.startedAt > STATE_TTL_MS) {
		await setMeta(key, null);
		await sendDm(
			channel,
			new EmbedBuilder()
				.setColor(COLORS.danger)
				.setDescription('This application timed out. Run `/apply` again to start over.')
		);
		return;
	}

	const guild = message.client.guilds.cache.get(state.guildId);
	const guildName = guild?.name ?? 'the server';

	const check = checkAnswer(state.step, content);
	if (!check.ok) {
		if (check.cancel) await setMeta(key, null);
		await sendDm(
			channel,
			new EmbedBuilder().setColor(COLORS.danger).setDescription(check.error)
		);
		return;
	}

	if (state.step === 'goals') {
		state.goals = content;
		await submitApplication(state, message);
		return;
	}

	switch (state.step) {
		case 'ign':
			state.ign = content;
			break;
		case 'age':
			state.age = Number(content);
			break;
		case 'timezone':
			state.timezone = content;
			break;
		case 'reason':
			state.reason = content;
			break;
	}

	const next = NEXT_STEP[state.step];
	if (!next) return;

	state.step = next;
	await writeJson(key, state);
	await sendDm(channel, questionEmbed(guildName, QUESTIONS[next](guildName)));
}

/** Approve / deny buttons in #staff-verify. */
export async function handleApplicationButton(interaction: ButtonInteraction): Promise<void> {
	const [scope, action, id] = interaction.customId.split(':');
	if (scope !== 'apply' || (action !== 'approve' && action !== 'deny') || !id) return;

	if (!hasStaffPermission(interaction.memberPermissions)) {
		await interaction.reply(ephemeral('Only staff with **Manage Server** can review applications.'));
		return;
	}

	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply(ephemeral('Applications can only be reviewed inside a server.'));
		return;
	}

	const app = await readJson<Application>(itemKey(id));
	if (!app || app.guildId !== guild.id) {
		await interaction.reply(ephemeral('That application is no longer on file.'));
		return;
	}

	if (app.status !== 'pending') {
		await interaction.reply(
			ephemeral(`This application was already ${app.status} by <@${app.reviewerId ?? 'staff'}>.`)
		);
		return;
	}

	// Role creation, member lookups and DM delivery can take longer than the
	// three-second acknowledgement window, so acknowledge before doing them.
	await interaction.deferUpdate();

	if (action === 'approve') {
		let role: Role;
		try {
			role = await ensureCitizenRole(guild);
		} catch (error) {
			await interaction.followUp(
				ephemeral(
					`I could not prepare the Citizen role: ${
						error instanceof Error ? error.message : 'unknown error'
					}. Check that I have **Manage Roles** and that my role is above it.`
				)
			);
			return;
		}

		const member = await guild.members.fetch(app.userId).catch(() => null);
		if (!member) {
			await interaction.followUp(
				ephemeral('That member has left the server. Deny the application instead.')
			);
			return;
		}

		try {
			await member.roles.add(role, `Application approved by ${interaction.user.tag}`);
		} catch (error) {
			await interaction.followUp(
				ephemeral(
					`I could not give <@&${role.id}> to <@${app.userId}>: ${
						error instanceof Error ? error.message : 'unknown error'
					}`
				)
			);
			return;
		}

		app.status = 'approved';
		app.reviewerId = interaction.user.id;
		app.decidedAt = Date.now();
		await writeJson(itemKey(id), app);
		await removePending(id);

		await interaction.editReply({
			embeds: [applicationEmbed(app, guild)],
			components: []
		});

		await member
			.send({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.bid)
						.setAuthor({ name: `Application approved · ${guild.name}` })
						.setDescription(
							`Welcome! Your application was approved and you now have the **${role.name}** role.`
						)
				]
			})
			.catch(() => undefined);
		return;
	}

	app.status = 'denied';
	app.reviewerId = interaction.user.id;
	app.decidedAt = Date.now();
	await writeJson(itemKey(id), app);
	await removePending(id);

	await interaction.editReply({
		embeds: [applicationEmbed(app, guild)],
		components: []
	});

	await interaction.client.users
		.fetch(app.userId)
		.then((user) =>
			user.send({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.danger)
						.setAuthor({ name: `Application not approved · ${guild.name}` })
						.setDescription(
							'Your application was not approved this time. Ask staff for feedback if you would like to try again.'
						)
				]
			})
		)
		.catch(() => undefined);
}

/** `/rolecitizen` — choose (or create) the role handed out after approval. */
export async function configureCitizenRole(interaction: ChatInputCommandInteraction): Promise<void> {
	const guild = interaction.guild;
	if (!guild) {
		await interaction.reply(ephemeral('This command only works inside a server.'));
		return;
	}

	if (!hasStaffPermission(interaction.memberPermissions)) {
		await interaction.reply(ephemeral('You need the **Manage Server** permission to change this role.'));
		return;
	}

	// Role and channel setup can take a moment; defer so the command never times out.
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const chosen = interaction.options.getRole('role');
	let role: Role;

	try {
		if (chosen) {
			if (chosen.id === guild.id) {
				await interaction.editReply({ content: 'Pick a normal role, not @everyone.' });
				return;
			}
			if (chosen.managed) {
				await interaction.editReply({
					content: 'That role is managed by an integration and cannot be given out.'
				});
				return;
			}
			const fetchedRole = await guild.roles.fetch(chosen.id);
			if (!fetchedRole) throw new Error('That role no longer exists.');
			role = fetchedRole;
			await setMeta(citizenKey(guild.id), role.id);
		} else {
			role = await ensureCitizenRole(guild);
		}
	} catch (error) {
		await interaction.editReply({
			content: `I could not configure the role: ${
				error instanceof Error ? error.message : 'unknown error'
			}. Check that I have **Manage Roles**.`
		});
		return;
	}

	let assigned = '';
	const target = interaction.options.getUser('member');
	if (target) {
		const member = await guild.members.fetch(target.id).catch(() => null);
		if (!member) {
			await interaction.editReply({ content: `<@${target.id}> is not a member of this server.` });
			return;
		}
		try {
			await member.roles.add(role, `Citizen role set by ${interaction.user.tag}`);
			assigned = `\n\n<@${target.id}> now has the role too.`;
		} catch (error) {
			await interaction.editReply({
				content: `I could not give the role to <@${target.id}>: ${
					error instanceof Error ? error.message : 'unknown error'
				}`
			});
			return;
		}
	}

	const embed = new EmbedBuilder()
		.setColor(COLORS.bid)
		.setAuthor({ name: 'Citizen role configured' })
		.setDescription(
			`Approved applicants will now receive <@&${role.id}>.\n` +
				`The Dweller role stays as the base role every new member gets.${assigned}`
		)
		.addFields({ name: 'Role', value: `${role.name} · \`${role.hexColor}\``, inline: true })
		.setFooter({ text: 'Settlers III · Applications' });

	const reviewChannel = await ensureStaffChannel(guild).catch(() => null);
	if (reviewChannel) {
		embed.addFields({
			name: 'Review channel',
			value: `<#${reviewChannel.id}>`,
			inline: true
		});
	}

	await interaction.editReply({ embeds: [embed] });
}
