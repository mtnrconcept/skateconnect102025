import type { RiderProfileEditorModalProps } from './profile/rider/RiderProfileEditorModal';
import RiderProfileEditorModal from './profile/rider/RiderProfileEditorModal';
import SponsorProfileEditorModal from './profile/sponsor/SponsorProfileEditorModal';

export type EditProfileModalProps = RiderProfileEditorModalProps;

export default function EditProfileModal(props: EditProfileModalProps) {
  if (props.profile.role === 'sponsor') {
    return <SponsorProfileEditorModal {...props} />;
  }

  return <RiderProfileEditorModal {...props} />;
}
