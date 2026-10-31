<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Image from '@tiptap/extension-image';
	import Placeholder from '@tiptap/extension-placeholder';

	let {
		value = '',
		onChange,
		onUpload,
		disabled = false
	}: {
		value?: string;
		onChange: (html: string) => void;
		onUpload: (file: File) => Promise<string>;
		disabled?: boolean;
	} = $props();

	let editorEl: HTMLDivElement;
	let fileInput: HTMLInputElement;
	let editor = $state<Editor | null>(null);
	let uploading = $state(false);
	let uploadError = $state('');

	function command(run: (current: Editor) => void): void {
		if (!editor || disabled) return;
		run(editor);
	}

	async function addImage(file: File): Promise<void> {
		if (!editor || disabled) return;
		uploading = true;
		uploadError = '';
		try {
			const url = await onUpload(file);
			editor.chain().focus().setImage({ src: url, alt: file.name }).run();
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'The image could not be uploaded.';
		} finally {
			uploading = false;
		}
	}

	function pickImage(): void {
		fileInput?.click();
	}

	onMount(() => {
		editor = new Editor({
			element: editorEl,
			editable: !disabled,
			content: value || '<p></p>',
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3] },
					link: {
						openOnClick: false,
						autolink: true,
						HTMLAttributes: {
							rel: 'noopener noreferrer nofollow',
							target: '_blank'
						}
					}
				}),
				Image.configure({
					allowBase64: false,
					HTMLAttributes: { class: 'editor-image' }
				}),
				Placeholder.configure({
					placeholder: 'Write the story. Use the toolbar for headings, lists, links and images.'
				})
			],
			editorProps: {
				handlePaste: (_view, event) => {
					const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
						file.type.startsWith('image/')
					);
					if (!files.length) return false;
					event.preventDefault();
					for (const file of files) void addImage(file);
					return true;
				},
				handleDrop: (_view, event) => {
					const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
						file.type.startsWith('image/')
					);
					if (!files.length) return false;
					event.preventDefault();
					for (const file of files) void addImage(file);
					return true;
				}
			},
			onUpdate: ({ editor: instance }) => {
				onChange(instance.getHTML());
			}
		});

		return () => {
			editor?.destroy();
			editor = null;
		};
	});

	$effect(() => {
		if (!editor) return;
		editor.setEditable(!disabled);
	});

	$effect(() => {
		if (!editor) return;
		const next = value || '<p></p>';
		if (editor.getHTML() !== next) {
			editor.commands.setContent(next, { emitUpdate: false });
		}
	});
</script>

<div class="editor-shell" class:disabled>
	<div class="editor-toolbar" aria-label="Formatting toolbar">
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('bold')}
			title="Bold"
			onclick={() => command((current) => current.chain().focus().toggleBold().run())}
		>
			<strong>B</strong>
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('italic')}
			title="Italic"
			onclick={() => command((current) => current.chain().focus().toggleItalic().run())}
		>
			<em>I</em>
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('underline')}
			title="Underline"
			onclick={() => command((current) => current.chain().focus().toggleUnderline().run())}
		>
			<span class="underline">U</span>
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('strike')}
			title="Strikethrough"
			onclick={() => command((current) => current.chain().focus().toggleStrike().run())}
		>
			<span class="line-through">S</span>
		</button>
		<span class="tool-divider"></span>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('heading', { level: 2 })}
			title="Heading"
			onclick={() => command((current) => current.chain().focus().toggleHeading({ level: 2 }).run())}
		>
			H2
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('heading', { level: 3 })}
			title="Subheading"
			onclick={() => command((current) => current.chain().focus().toggleHeading({ level: 3 }).run())}
		>
			H3
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('bulletList')}
			title="Bullet list"
			onclick={() => command((current) => current.chain().focus().toggleBulletList().run())}
		>
			• List
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('orderedList')}
			title="Numbered list"
			onclick={() => command((current) => current.chain().focus().toggleOrderedList().run())}
		>
			1. List
		</button>
		<button
			type="button"
			class="tool"
			class:active={editor?.isActive('blockquote')}
			title="Quote"
			onclick={() => command((current) => current.chain().focus().toggleBlockquote().run())}
		>
			“ ”
		</button>
		<span class="tool-divider"></span>
		<button
			type="button"
			class="tool"
			title="Add link"
			onclick={() => {
				if (!editor || disabled) return;
				const previous = editor.getAttributes('link').href as string | undefined;
				const href = window.prompt('Link URL', previous ?? 'https://');
				if (href === null) return;
				if (!href.trim()) {
					editor.chain().focus().extendMarkRange('link').unsetLink().run();
					return;
				}
				const url = /^[a-z]+:/i.test(href) ? href : `https://${href}`;
				editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
			}}
		>
			Link
		</button>
		<button type="button" class="tool" title="Add image" onclick={pickImage} disabled={disabled || uploading}>
			{uploading ? 'Uploading…' : 'Image'}
		</button>
		<span class="tool-divider"></span>
		<button
			type="button"
			class="tool"
			title="Undo"
			onclick={() => command((current) => current.chain().focus().undo().run())}
		>
			↶
		</button>
		<button
			type="button"
			class="tool"
			title="Redo"
			onclick={() => command((current) => current.chain().focus().redo().run())}
		>
			↷
		</button>
	</div>

	<div bind:this={editorEl} class="editor-content"></div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={(event) => {
			const file = event.currentTarget.files?.[0];
			if (file) void addImage(file);
			event.currentTarget.value = '';
		}}
	/>
	{#if uploadError}
		<p class="px-3 pb-2 text-[11px] text-danger">{uploadError}</p>
	{/if}
</div>

<style>
	.editor-shell {
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		background: rgba(6, 10, 15, 0.7);
	}

	.editor-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.15rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.4rem;
	}

	.tool {
		border-radius: 0.4rem;
		padding: 0.35rem 0.5rem;
		color: var(--color-mist-400);
		font-size: 0.72rem;
		font-weight: 600;
		transition: 120ms ease;
	}

	.tool:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-mist-100);
	}

	.tool.active {
		background: rgba(52, 211, 153, 0.12);
		color: var(--color-bid);
	}

	.tool:disabled {
		opacity: 0.5;
	}

	.tool-divider {
		width: 1px;
		height: 1.1rem;
		margin: 0 0.25rem;
		background: rgba(255, 255, 255, 0.08);
	}

	.editor-content {
		min-height: 18rem;
		padding: 1rem;
	}

	.editor-content :global(.tiptap) {
		outline: none;
		color: var(--color-mist-200);
		font-size: 0.92rem;
		line-height: 1.8;
	}

	.editor-content :global(.tiptap p) {
		margin: 0.75rem 0;
	}

	.editor-content :global(.tiptap h2) {
		margin: 1.4rem 0 0.5rem;
		font-family: var(--font-serif);
		font-size: 1.35rem;
		color: var(--color-mist-100);
	}

	.editor-content :global(.tiptap h3) {
		margin: 1.1rem 0 0.4rem;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-mist-100);
	}

	.editor-content :global(.tiptap ul),
	.editor-content :global(.tiptap ol) {
		margin: 0.75rem 0;
		padding-left: 1.25rem;
	}

	.editor-content :global(.tiptap ul) {
		list-style: disc;
	}

	.editor-content :global(.tiptap ol) {
		list-style: decimal;
	}

	.editor-content :global(.tiptap blockquote) {
		margin: 1rem 0;
		border-left: 2px solid var(--color-bid);
		padding-left: 0.9rem;
		color: var(--color-mist-300);
		font-family: var(--font-serif);
		font-style: italic;
	}

	.editor-content :global(.tiptap a) {
		color: var(--color-bid);
		text-decoration: underline;
	}

	.editor-content :global(.tiptap img) {
		max-width: 100%;
		margin: 1rem 0;
		border-radius: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.editor-content :global(.tiptap p.is-editor-empty:first-child::before) {
		float: left;
		height: 0;
		color: var(--color-mist-500);
		content: attr(data-placeholder);
		pointer-events: none;
	}

	.editor-content :global(.tiptap hr) {
		margin: 1.5rem 0;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.disabled {
		opacity: 0.7;
	}
</style>
