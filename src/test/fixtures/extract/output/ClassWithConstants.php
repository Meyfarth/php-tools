<?php

class EmptyClass
{
    public const FIRST_NAME = 'Jean';
    public const LAST_NAME = 'Michel';
    public function __construct(string $lastName = self::LAST_NAME)
    {

    }
}