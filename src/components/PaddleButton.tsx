'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

// Declare the Paddle object on the window
declare global {
    interface Window {
        Paddle: any;
    }
}

const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const PADDLE_PRICE_ID = "pri_01k3r4y39hd6rfe1qazvd3b5v1"; // The ID provided by the user

const PaddleButton = ({ onPaymentSuccess }: { onPaymentSuccess: () => void }) => {

    useEffect(() => {
        if (typeof window !== 'undefined' && window.Paddle) {
            if (PADDLE_CLIENT_TOKEN) {
                window.Paddle.Setup({ token: PADDLE_CLIENT_TOKEN });
            } else {
                console.error("Paddle Client Token is not set.");
            }
        }
    }, []);

    const handlePaddleCheckout = () => {
        if (!window.Paddle || !PADDLE_CLIENT_TOKEN) {
            toast.error("Paddle is not loaded or configured correctly.");
            return;
        }

        window.Paddle.Checkout.open({
            items: [{
                priceId: PADDLE_PRICE_ID,
                quantity: 1
            }],
            eventCallback: function(data: any) {
                if (data.event === 'checkout.completed') {
                    toast.success('Payment successful! Thank you for your support.');
                    onPaymentSuccess();
                }
            }
        });
    };

    return (
        <button
            onClick={handlePaddleCheckout}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            Pay with Card
        </button>
    );
};

export default PaddleButton;