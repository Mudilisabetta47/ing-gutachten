'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { orgFields, str } from '@/server/admin/fields';
import { archiveOrganization, createOrganization, restoreOrganization, updateOrganization } from '@/server/pipeline/masterdata';
import { ORG_LABELS, orgKindFromSlug } from '@/lib/workflow';

const back = (kind: string) => `/admin/stammdaten/${ORG_LABELS[orgKindFromSlug(kind) ?? 'INSURANCE'].slug}`;

export async function createOrganizationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  const slug = str(fd, 'kind');
  let id: string;
  try {
    const user = await authorize('masterdata.write');
    const kind = orgKindFromSlug(slug);
    if (!kind) return { error: 'Unbekannte Art.', values };
    id = (await createOrganization(user, kind, orgFields(fd))).id;
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath(back(slug));
  redirect(`${back(slug)}/${id}/`);
}

export async function updateOrganizationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  const slug = str(fd, 'kind');
  try {
    const user = await authorize('masterdata.write');
    await updateOrganization(user, str(fd, 'id'), orgFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath(back(slug));
  return { ok: true, message: 'Gespeichert.', values };
}

export async function archiveOrganizationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, 'kind');
  try {
    const user = await authorize('masterdata.write');
    await archiveOrganization(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(back(slug));
  redirect(`${back(slug)}/`);
}

export async function restoreOrganizationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, 'kind');
  try {
    const user = await authorize('masterdata.write');
    await restoreOrganization(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(back(slug));
  redirect(`${back(slug)}/${str(fd, 'id')}/`);
}
