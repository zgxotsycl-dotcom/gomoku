'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import type { CreateOrderData, CreateOrderActions, OnApproveData, OnApproveActions } from '@paypal/paypal-js';

declare global {
    interface Window {
        paypal: any;
    }
}

const PayPalButton = ({ onPaymentSuccess }: { onPaymentSuccess: () => void }) => {
    const paypalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.paypal) {
            window.paypal.Buttons({
                createOrder: async (data: CreateOrderData, actions: CreateOrderActions) => {
                    try {
                        const { data: functionData, error } = await supabase.functions.invoke('create-paypal-order', {
                            body: { locale: 'en' } // Assuming a default or passed-in locale
                        });
                        if (error) {
                            throw new Error(error.message);
                        }
                        return functionData.orderId;
                    } catch (err) {
                        toast.error('Could not initiate PayPal payment.');
                        console.error(err);
                        return ''; // Return empty string on failure
                    }
                },
                onApprove: async (data: OnApproveData, actions: OnApproveActions) => {
                    toast.success('Payment approved! Please wait while we verify...');
                    onPaymentSuccess();
                    // The webhook will handle the final fulfillment.
                    // This capture is for completing the flow on PayPal's side.
                    return actions.order.capture();
                },
                onError: (err: any) => {
                    toast.error('An error occurred with the PayPal payment.');
                    console.error('PayPal Error:', err);
                },
            }).render(paypalRef.current);
        } else {
            console.error("PayPal SDK not loaded.");
        }
    }, [onPaymentSuccess]);

    return <div ref={paypalRef}></div>;
};

export default PayPalButton;