
module suidouble_chat::suidouble_chat {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::vector::{Self, length};

    use sui::dynamic_object_field::{Self};

    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    
    use std::debug;
    use sui::pay;

    use sui::event::emit;

    /// Max text length.
    const MAX_TEXT_LENGTH_FREE: u64 = 256;
    const MAX_TEXT_LENGTH: u64 = 512;

    /// Min price for a long message
    const MIN_PRICE: u64 = 100;

    /// Text size overflow.
    const ETextOverflow: u64 = 0;

    /// Not enough funds to pay for the good in question
    const EInsufficientFunds: u64 = 1;

    /// For when supplied Coin is zero.
    const EZeroAmount: u64 = 2;

    // ======== Events =========

    /// Event. When a new chat has been created.
    struct ChatShopCreated has copy, drop { id: ID }
    struct ChatTopMessageCreated has copy, drop { id: ID, top_response_id: ID }
    struct ChatResponseCreated has copy, drop { id: ID, top_message_id: ID, seq_n: u64 }

    /// Capability that grants an owner the right to collect profits.
    struct ChatOwnerCap has key { id: UID }

    /// A shared object. `key` ability is required.
    struct ChatShop has key {
        id: UID,
        price: u64,
        balance: Balance<SUI>
    }

    struct ChatTopMessage has key, store {
        id: UID,
        chat_shop_id: ID,
        chat_top_response_id: ID,
        author: address,
        responses_count: u64,
    }

    struct ChatResponse has key, store {
        id: UID,
        chat_top_message_id: ID,
        author: address,
        text: vector<u8>,
        // app-specific metadata. We do not enforce a metadata format and delegate this to app layer.
        metadata: vector<u8>,
        seq_n: u64, // n of message in thread
    }

    /// Init function is often ideal place for initializing
    /// a shared object as it is called only once.
    ///
    /// To share an object `transfer::share_object` is used.
    fun init(ctx: &mut TxContext) {
        transfer::transfer(ChatOwnerCap {
            id: object::new(ctx)
        }, tx_context::sender(ctx));

        let id = object::new(ctx);
        emit(ChatShopCreated { id: object::uid_to_inner(&id) });

        // Share the object to make it accessible to everyone!
        transfer::share_object(ChatShop {
            id: id,
            price: 1000,
            balance: balance::zero()
        })
    }

    // /// Simple ChatResponse.text getter.
    // public fun text(chat_response: &ChatResponse): String {
    //     chat_response.text
    // }

    /// Mint (post) a ChatTopMessage object without referencing another object.
    public entry fun post(
        chat_shop: &ChatShop,
        text: vector<u8>,
        metadata: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(length(&text) <= MAX_TEXT_LENGTH_FREE, ETextOverflow);
        let id = object::new(ctx);
        let chat_response_id = object::new(ctx);

        emit(ChatTopMessageCreated { id: object::uid_to_inner(&id), top_response_id: object::uid_to_inner(&chat_response_id),  });
        emit(ChatResponseCreated { id: object::uid_to_inner(&chat_response_id), top_message_id: object::uid_to_inner(&id), seq_n: 0 });

        let chat_top_message = ChatTopMessage {
            id: id,
            chat_shop_id: object::id(chat_shop),
            author: tx_context::sender(ctx),
            chat_top_response_id: object::uid_to_inner(&chat_response_id),
            responses_count: 0,
        };

        let chat_response = ChatResponse {
            id: chat_response_id,
            chat_top_message_id: object::id(&chat_top_message),
            author: tx_context::sender(ctx),
            text: text,
            metadata,
            seq_n: 0,
        };
        dynamic_object_field::add(&mut chat_top_message.id, b"as_chat_response", chat_response);

        transfer::share_object(chat_top_message);
    }

    /// Mint (post) a ChatTopMessage object without referencing another object.
    public entry fun post_pay(
        chat_shop: &mut ChatShop,
        sui: Coin<SUI>,
        text: vector<u8>,
        metadata: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(length(&text) <= MAX_TEXT_LENGTH, ETextOverflow);
        assert!(coin::value(&sui) > 0, EZeroAmount);
        assert!(coin::value(&sui) >= MIN_PRICE, EInsufficientFunds);

        let sui_balance = coin::into_balance(sui);
        balance::join(&mut chat_shop.balance, sui_balance);

        let id = object::new(ctx);
        let chat_response_id = object::new(ctx);

        emit(ChatTopMessageCreated { id: object::uid_to_inner(&id), top_response_id: object::uid_to_inner(&chat_response_id),  });
        emit(ChatResponseCreated { id: object::uid_to_inner(&chat_response_id), top_message_id: object::uid_to_inner(&id), seq_n: 0 });

        let chat_top_message = ChatTopMessage {
            id: id,
            chat_shop_id: object::id(chat_shop),
            author: tx_context::sender(ctx),
            chat_top_response_id: object::uid_to_inner(&chat_response_id),
            responses_count: 0,
        };

        let chat_response = ChatResponse {
            id: chat_response_id,
            chat_top_message_id: object::id(&chat_top_message),
            author: tx_context::sender(ctx),
            text: text,
            metadata,
            seq_n: 0,
        };
        dynamic_object_field::add(&mut chat_top_message.id, b"as_chat_response", chat_response);

        transfer::share_object(chat_top_message);
    }

    public entry fun post_pay_with_coin_vector(
        chat_shop: &mut ChatShop,
        coins: vector<Coin<SUI>>,
        text: vector<u8>,
        metadata: vector<u8>,
        ctx: &mut TxContext
    ) {
        let base = vector::pop_back(&mut coins);
        pay::join_vec(&mut base, coins);
        post_pay(chat_shop, base, text, metadata, ctx);
    }

    /// Mint (post) a ChatResponse object 
    public entry fun reply(
        chat_top_message: &mut ChatTopMessage,
        text: vector<u8>,
        metadata: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(length(&text) <= MAX_TEXT_LENGTH_FREE, ETextOverflow);

        let dynamic_field_exists = dynamic_object_field::exists_(&chat_top_message.id, b"as_chat_response");
        if (dynamic_field_exists) {
            let top_level_chat_response = dynamic_object_field::remove<vector<u8>, ChatResponse>(&mut chat_top_message.id, b"as_chat_response");
            transfer::transfer(top_level_chat_response, chat_top_message.author);
        };

        chat_top_message.responses_count = chat_top_message.responses_count + 1;

        let id = object::new(ctx);

        emit(ChatResponseCreated { id: object::uid_to_inner(&id), top_message_id: object::uid_to_inner(&chat_top_message.id), seq_n: chat_top_message.responses_count });

        let chat_response = ChatResponse {
            id: id,
            chat_top_message_id: object::id(chat_top_message),
            author: tx_context::sender(ctx),
            text: text,
            metadata,
            seq_n: chat_top_message.responses_count,
        };

        transfer::transfer(chat_response, tx_context::sender(ctx));
    }
    
    /// Permanently delete `ChatResponse`
    public entry fun burn_response(chat_response: ChatResponse, _: &mut TxContext) {
        let ChatResponse { id, chat_top_message_id: _, author: _, text: _, metadata: _, seq_n: _ } = chat_response;
        object::delete(id)
    }


    // /// Mint (post) a ChatResponse object 
    // public entry fun reply_pay(
    //     chat_top_message: &mut ChatTopMessage,
    //     sui: Coin<SUI>,
    //     text: vector<u8>,
    //     metadata: vector<u8>,
    //     ctx: &mut TxContext,
    // ) acquires ChatShop {
    //     assert!(length(&text) <= MAX_TEXT_LENGTH, ETextOverflow);

    //     let dynamic_field_exists = dynamic_object_field::exists_(&chat_top_message.id, b"as_chat_response");
    //     if (dynamic_field_exists) {
    //         let top_level_chat_response = dynamic_object_field::remove<vector<u8>, ChatResponse>(&mut chat_top_message.id, b"as_chat_response");
    //         transfer::transfer(top_level_chat_response, chat_top_message.author);
    //     };

    //     chat_top_message.responses_count = chat_top_message.responses_count + 1;
        
    //     let chat_shop = borrow_global_mut<ChatShop>(id_to_address(&chat_top_message.chat_shop_id));
    //     let sui_balance = coin::into_balance(sui);
    //     balance::join(&mut chat_shop.balance, sui_balance);

    //     let id = object::new(ctx);

    //     emit(ChatResponseCreated { id: object::uid_to_inner(&id), top_message_id: object::uid_to_inner(&chat_top_message.id), seq_n: chat_top_message.responses_count });

    //     let chat_response = ChatResponse {
    //         id: id,
    //         chat_top_message_id: object::id(chat_top_message),
    //         author: tx_context::sender(ctx),
    //         text: text,
    //         metadata,
    //         seq_n: chat_top_message.responses_count,
    //     };

    //     transfer::transfer(chat_response, tx_context::sender(ctx));
    // }

    /// Mint a lot of responses (we need this to unit test SuiPaginatedResponse faster)
    public entry fun fill(
        chat_top_message: &mut ChatTopMessage,
        text: vector<u8>,
        metadata: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(length(&text) <= MAX_TEXT_LENGTH, ETextOverflow);

        let dynamic_field_exists = dynamic_object_field::exists_(&chat_top_message.id, b"as_chat_response");
        if (dynamic_field_exists) {
            let top_level_chat_response = dynamic_object_field::remove<vector<u8>, ChatResponse>(&mut chat_top_message.id, b"as_chat_response");
            transfer::transfer(top_level_chat_response, chat_top_message.author);
        };

        let i: u64 = 0;

        while (i < 60) {
            let id = object::new(ctx);

            emit(ChatResponseCreated { id: object::uid_to_inner(&id), top_message_id: object::uid_to_inner(&chat_top_message.id), seq_n: chat_top_message.responses_count });

            let chat_response = ChatResponse {
                id: id,
                chat_top_message_id: object::id(chat_top_message),
                author: tx_context::sender(ctx),
                text: text,
                metadata,
                seq_n: chat_top_message.responses_count,
            };
            transfer::transfer(chat_response, tx_context::sender(ctx));
            i = i + 1;
        };
    }


    #[test]
    public fun test_module_init() {
        use sui::test_scenario;

        // Create test address representing game admin
        let admin = @0xBABE;
        let somebody = @0xFAFE;
        let anybody = @0xFAAE;
        // let player = @0x0;

        // First transaction to emulate module initialization
        let scenario_val = test_scenario::begin(admin);
        let scenario = &mut scenario_val;

        // Run the module initializers
        test_scenario::next_tx(scenario, admin);
        {
            init(test_scenario::ctx(scenario));

        };
        // Run the module initializers
        test_scenario::next_tx(scenario, somebody);
        {
            let chat_shop = test_scenario::take_shared<ChatShop>(scenario);
            // let chat_shop_ref = &chat_shop;
            debug::print(&chat_shop);

            let chat_shop_ref = &chat_shop;
            post(chat_shop_ref, b"test", b"metadata", test_scenario::ctx(scenario));

            // post(chat_shop_ref, b"test", b"metadata", test_scenario::ctx(scenario));

            test_scenario::return_shared(chat_shop);
        };

        test_scenario::next_tx(scenario, anybody);
        {    
            // let chat_top_message = test_scenario::take_from_sender<ChatTopMessage>(scenario);
            let chat_top_message = test_scenario::take_shared<ChatTopMessage>(scenario);
            // let chat_shop_ref = &chat_shop;
            debug::print(&chat_top_message);
            debug::print(&mut chat_top_message);

            // let chat_top_message_ref = &chat_top_message;
            reply(&mut chat_top_message, b"response", b"metadata", test_scenario::ctx(scenario));

            // post(chat_shop_ref, b"test", b"metadata", test_scenario::ctx(scenario));

            test_scenario::return_shared(chat_top_message);
            // test_scenario::return_to_sender(scenario, chat_top_message);
        };

        test_scenario::next_tx(scenario, anybody);
        {    
            let chat_shop = test_scenario::take_shared<ChatShop>(scenario);
            debug::print(&chat_shop);

            // let chat_shop_ref = &chat_shop;
            let ctx = test_scenario::ctx(scenario);
            post_pay(&mut chat_shop, coin::mint_for_testing<SUI>(100, ctx), b"test", b"metadata", test_scenario::ctx(scenario));

            // post(chat_shop_ref, b"test", b"metadata", test_scenario::ctx(scenario));

            debug::print(&chat_shop);

            test_scenario::return_shared(chat_shop);
        };

        test_scenario::next_tx(scenario, anybody);
        {    
            // let chat_top_message = test_scenario::take_from_sender<ChatTopMessage>(scenario);
            let chat_top_message = test_scenario::take_shared<ChatTopMessage>(scenario);
            // let chat_shop_ref = &chat_shop;
            debug::print(&mut chat_top_message);

            // let chat_top_message_ref = &chat_top_message;
            reply(&mut chat_top_message, b"response", b"metadata", test_scenario::ctx(scenario));

            // post(chat_shop_ref, b"test", b"metadata", test_scenario::ctx(scenario));

            test_scenario::return_shared(chat_top_message);
            // test_scenario::return_to_sender(scenario, chat_top_message);
        };
        test_scenario::end(scenario_val);
    }
}
