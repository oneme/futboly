export class Surprise {
    text: string;
    action: { method: string; args: any[] };

    constructor(text: string, action: any) {
        this.text = text;
        this.action = action;
    }

    executeAction(target: any) {
        const { method, args } = this.action;
        if (typeof target[method] === 'function') {
            target[method](...args);
        } else {
            console.error(`Method ${method} does not exist on target object.`);
        }
    }
}