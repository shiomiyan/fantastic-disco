import { z } from "zod";

const nonEmptyString = (key: string) =>
	z.string().refine((value) => value.trim() !== "", `${key} must not be empty`);

const createdSchema = z.union([
	z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
		message: "created must be a valid date string",
	}),
	z.date().refine((value) => !Number.isNaN(value.getTime()), {
		message: "created must be a valid date",
	}),
]);

export const blogFrontmatterSchema = z
	.object({
		title: nonEmptyString("title"),
		description: nonEmptyString("description"),
		created: createdSchema,
		draft: z.boolean(),
		id: nonEmptyString("id"),
		categories: z.array(z.string()),
		tags: z.array(z.string()),
		slug: nonEmptyString("slug")
			.regex(
				/^[a-zA-Z0-9/_-]+$/,
				"slug may only contain letters, numbers, slash, underscore, and hyphen",
			)
			.refine(
				(value) => !value.startsWith("/") && !value.endsWith("/") && !value.includes(".."),
				"slug must be a relative post directory",
			),
	})
	.transform((data) => ({
		...data,
		created: data.created instanceof Date ? data.created.toISOString() : data.created,
	}));

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

export function validateFrontmatter(data: unknown): BlogFrontmatter {
	return blogFrontmatterSchema.parse(data);
}
