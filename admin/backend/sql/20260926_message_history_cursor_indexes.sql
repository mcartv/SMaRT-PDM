-- SMaRT-PDM Messaging cursor-pagination indexes.
-- Additive only: no message data is changed.

CREATE INDEX IF NOT EXISTS idx_messages_private_sender_receiver_cursor
ON public.messages (
    sender_id,
    receiver_id,
    sent_at DESC,
    message_id DESC
)
WHERE room_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_private_receiver_sender_cursor
ON public.messages (
    receiver_id,
    sender_id,
    sent_at DESC,
    message_id DESC
)
WHERE room_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_room_history_cursor
ON public.messages (
    room_id,
    sent_at DESC,
    message_id DESC
)
WHERE room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_hidden_states_viewer_lookup
ON public.message_hidden_states (
    user_id,
    message_id
);

CREATE INDEX IF NOT EXISTS idx_message_read_states_message_user
ON public.message_read_states (
    message_id,
    user_id,
    is_read
);
