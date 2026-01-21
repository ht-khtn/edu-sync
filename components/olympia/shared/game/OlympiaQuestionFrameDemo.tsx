import React, { useState } from 'react';
import OlympiaQuestionFrame from './OlympiaQuestionFrame';

export default function OlympiaQuestionFrameDemo() {
    const [open, setOpen] = useState(true);

    return (
        <div>
            <button
                style={{ position: 'fixed', top: 18, right: 18, zIndex: 1100 }}
                onClick={() => setOpen((s) => !s)}
            >
                Toggle Frame
            </button>

            <OlympiaQuestionFrame open={open}>
                <div>
                    <h1 style={{ margin: 0, fontWeight: 700 }}>Đây là nội dung câu hỏi</h1>
                    <p style={{ marginTop: 12 }}>Ví dụ: Một câu hỏi phong cách Olympia, căn giữa, font sans-serif.</p>
                </div>
            </OlympiaQuestionFrame>
        </div>
    );
}
